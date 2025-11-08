// Test Stripe Payment Processing
require('dotenv').config();
const stripe = require('stripe');

// Get Stripe secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_LIVE;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
  console.log('\nMake sure you have STRIPE_SECRET_KEY in your .env file');
  process.exit(1);
}

// Initialize Stripe
const stripeClient = stripe(stripeSecretKey);

console.log('💳 Testing Stripe Payment Processing...\n');
console.log(`Using key: ${stripeSecretKey.substring(0, 12)}...${stripeSecretKey.substring(stripeSecretKey.length - 4)}`);
console.log(`Key type: ${stripeSecretKey.startsWith('sk_live_') ? 'LIVE' : stripeSecretKey.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN'}\n`);

// Test payment with a checkout session (matches actual app flow)
async function testPayment() {
  try {
    console.log('📡 Creating test checkout session...');
    console.log('   This matches how the app actually processes payments.\n');
    
    // Create a checkout session for $1.00 USD (one-time payment)
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Payment - JukeTogether',
              description: 'Test payment to verify Stripe integration',
            },
            unit_amount: 100, // $1.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment (not subscription)
      success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://example.com/cancel',
      metadata: {
        test: 'true',
        purpose: 'verification'
      }
    });

    console.log('✅ Checkout session created successfully!\n');
    console.log('Checkout Session Details:');
    console.log(`  - Session ID: ${session.id}`);
    console.log(`  - Amount: $${(session.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()}`);
    console.log(`  - Status: ${session.status}`);
    console.log(`  - Payment Status: ${session.payment_status}`);
    console.log(`  - URL: ${session.url}\n`);

    console.log('💳 To complete the test payment:');
    console.log('   1. Open the URL above in your browser');
    console.log('   2. Use Stripe test card: 4242 4242 4242 4242');
    console.log('   3. Use any future expiry date (e.g., 12/25)');
    console.log('   4. Use any 3-digit CVC (e.g., 123)');
    console.log('   5. Use any ZIP code (e.g., 12345)\n');

    // Also test creating a payment intent (for API endpoint testing)
    console.log('📡 Creating test payment intent (for API endpoint)...');
    
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: 100, // $1.00 in cents
      currency: 'usd',
      description: 'Test payment intent for JukeTogether',
      metadata: {
        test: 'true',
        purpose: 'verification'
      }
    });

    console.log('✅ Payment intent created successfully!\n');
    console.log('Payment Intent Details:');
    console.log(`  - ID: ${paymentIntent.id}`);
    console.log(`  - Amount: $${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`);
    console.log(`  - Status: ${paymentIntent.status}`);
    console.log(`  - Client Secret: ${paymentIntent.client_secret.substring(0, 20)}...\n`);

    console.log('✨ Stripe payment processing is working correctly!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Can create checkout sessions (used for subscriptions)');
    console.log('   ✅ Can create payment intents (used for one-time payments)');
    console.log('   ✅ Stripe API connection is functional\n');
    console.log('💡 To test a full payment flow:');
    console.log('   - Use the checkout session URL above, or');
    console.log('   - Call the API endpoint: POST /api/stripe/test-payment\n');

  } catch (error) {
    console.error('\n❌ Test payment failed!\n');
    console.error('Error:', error.message);
    
    if (error.type === 'StripeCardError') {
      console.error('\n💡 Card Error - This usually means:');
      console.error('  - The card number is invalid');
      console.error('  - The card has insufficient funds (for test cards, this shouldn\'t happen)');
      console.error('  - The card was declined');
    } else if (error.type === 'StripeAuthenticationError') {
      console.error('\n💡 Authentication Error - Check your API key');
    } else if (error.type === 'StripeAPIError') {
      console.error('\n💡 API Error - Check your Stripe dashboard for more details');
    }
    
    process.exit(1);
  }
}

// Run the test
testPayment();

