// Vercel serverless function handler
// Import the Express app (without starting the server)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Use node-fetch for older Node versions, or built-in fetch for Node 18+
let fetch;
try {
  if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
  } else {
    fetch = require('node-fetch');
  }
} catch (e) {
  console.warn('Fetch not available. Install node-fetch: npm install node-fetch@2');
  fetch = null;
}

const app = express();
const server = http.createServer(app);

// Only initialize Socket.io if not in serverless environment
// Vercel serverless functions don't support persistent WebSocket connections
// For Socket.io, you may need a separate service or Vercel's WebSocket support
let io = null;
if (process.env.VERCEL) {
  console.log('Running in Vercel - Socket.io will be limited');
} else {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
}

app.use(cors());

// Stripe webhook endpoint needs raw body for signature verification
// This must be BEFORE express.json() middleware
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes
app.use(express.json());

// Static files are now served by Vercel from web-build directory
// app.use(express.static(path.join(__dirname, '..', 'public')));

// Import Supabase and Stripe
let supabase = null;
let stripe = null;

try {
  const authModule = require('../src/auth');
  supabase = authModule.supabase;
} catch (error) {
  console.warn('Auth module not available:', error.message);
}

try {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_LIVE;
  if (stripeSecretKey) {
    stripe = require('stripe')(stripeSecretKey);
  }
} catch (error) {
  console.warn('Stripe not configured:', error.message);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', vercel: true });
});

// Create Stripe Checkout Session for subscription upgrade
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { tier } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!tier) {
      return res.status(400).json({ error: 'Tier is required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // Get tier pricing from database
    const { data: tierData, error: tierError } = await supabase
      .from('subscription_tier_settings')
      .select('*')
      .eq('tier', tier)
      .single();

    if (tierError || !tierData) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    const price = parseFloat(tierData.price || 0);
    if (price <= 0) {
      return res.status(400).json({ error: 'Invalid tier price' });
    }

    // Get user's email
    const userEmail = user.email || user.user_metadata?.email;

    // Determine success and cancel URLs based on platform
    const baseUrl = process.env.FRONTEND_URL || 'https://juketogether.vercel.app';
    const successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/subscription?canceled=true`;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tierData.display_name || tier} Subscription`,
              description: tierData.description || `Upgrade to ${tier} tier`,
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: userEmail,
      metadata: {
        user_id: user.id,
        tier: tier,
        display_name: tierData.display_name || tier,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Stripe webhook endpoint
app.post('/api/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // Support multiple webhook secrets (snapshot and thin payload)
  const webhookSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,           // Snapshot payload secret
    process.env.STRIPE_WEBHOOK_SECRET_THIN,      // Thin payload secret
  ].filter(Boolean); // Remove undefined values

  if (webhookSecrets.length === 0) {
    console.error('No STRIPE_WEBHOOK_SECRET configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!stripe) {
    console.error('Stripe is not initialized');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let event;
  let verified = false;

  // Try to verify with each webhook secret
  for (const webhookSecret of webhookSecrets) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      verified = true;
      break;
    } catch (err) {
      // Try next secret
      continue;
    }
  }

  if (!verified) {
    console.error('Webhook signature verification failed with all secrets');
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('PaymentIntent succeeded:', paymentIntent.id);
        // Handle successful payment
        // You can update user subscription here if needed
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        console.log('Subscription event:', event.type, subscription.id);
        
        // Update user subscription tier in Supabase
        if (supabase && subscription.metadata?.user_id) {
          const userId = subscription.metadata.user_id;
          const tier = subscription.metadata.tier || 'standard';
          
          // Get current tier before updating
          const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();
          
          const oldTier = currentProfile?.subscription_tier || 'free';
          
          // Only proceed if tier actually changed
          if (oldTier !== tier) {
            // Get tier display names
            const { data: oldTierData } = await supabase
              .from('subscription_tier_settings')
              .select('display_name')
              .eq('tier', oldTier)
              .single();
            
            const { data: newTierData } = await supabase
              .from('subscription_tier_settings')
              .select('display_name')
              .eq('tier', tier)
              .single();
            
            const oldTierDisplayName = oldTierData?.display_name || oldTier.charAt(0).toUpperCase() + oldTier.slice(1);
            const newTierDisplayName = newTierData?.display_name || tier.charAt(0).toUpperCase() + tier.slice(1);
            
            // Determine if it's an upgrade or downgrade
            const tierHierarchy = { free: 0, rookie: 1, standard: 2, pro: 3 };
            const oldTierLevel = tierHierarchy[oldTier] ?? 0;
            const newTierLevel = tierHierarchy[tier] ?? 0;
            const isUpgrade = newTierLevel > oldTierLevel;
            const isDowngrade = newTierLevel < oldTierLevel;
            
            let title, message;
            if (isUpgrade) {
              title = `🎉 Upgraded to ${newTierDisplayName} Tier!`;
              message = `Your subscription has been upgraded from ${oldTierDisplayName} to ${newTierDisplayName}. Enjoy your new features!`;
            } else if (isDowngrade) {
              title = `Subscription Changed to ${newTierDisplayName} Tier`;
              message = `Your subscription has been changed from ${oldTierDisplayName} to ${newTierDisplayName}.`;
            } else {
              title = `Subscription Updated to ${newTierDisplayName} Tier`;
              message = `Your subscription tier has been updated to ${newTierDisplayName}.`;
            }
            
            // Create notification
            await supabase
              .from('notifications')
              .insert({
                user_id: userId,
                type: 'tier_change',
                title: title,
                message: message,
                metadata: {
                  old_tier: oldTier,
                  new_tier: tier,
                },
                seen: false,
              });
          }
          
          const { error } = await supabase
            .from('user_profiles')
            .update({
              subscription_tier: tier,
              subscription_updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
          
          if (error) {
            console.error('Error updating subscription tier:', error);
          } else {
            console.log(`Updated subscription tier for user ${userId} to ${tier}`);
          }
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log('Subscription deleted:', deletedSubscription.id);
        
        // Downgrade user to free tier
        if (supabase && deletedSubscription.metadata?.user_id) {
          const userId = deletedSubscription.metadata.user_id;
          
          // Get current tier before updating
          const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single();
          
          const oldTier = currentProfile?.subscription_tier || 'free';
          const newTier = 'free';
          
          // Only create notification if tier actually changed
          if (oldTier !== newTier) {
            // Get tier display names
            const { data: oldTierData } = await supabase
              .from('subscription_tier_settings')
              .select('display_name')
              .eq('tier', oldTier)
              .single();
            
            const oldTierDisplayName = oldTierData?.display_name || oldTier.charAt(0).toUpperCase() + oldTier.slice(1);
            const newTierDisplayName = 'Free';
            
            // Create notification
            await supabase
              .from('notifications')
              .insert({
                user_id: userId,
                type: 'tier_change',
                title: `Subscription Changed to ${newTierDisplayName} Tier`,
                message: `Your subscription has been changed from ${oldTierDisplayName} to ${newTierDisplayName}.`,
                metadata: {
                  old_tier: oldTier,
                  new_tier: newTier,
                },
                seen: false,
              });
          }
          
          const { error } = await supabase
            .from('user_profiles')
            .update({
              subscription_tier: 'free',
              subscription_updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
          
          if (error) {
            console.error('Error downgrading subscription:', error);
          } else {
            console.log(`Downgraded user ${userId} to free tier`);
          }
        }
        break;

      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        // Handle successful checkout
        // The subscription.created event will handle the tier update
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

// Root route is now handled by Vercel static build (Expo web app)
// app.get('/', ...) removed - Vercel serves index.html from web-build

// For Vercel, export the app (not the server)
// The server.listen() is handled by Vercel
module.exports = app;
