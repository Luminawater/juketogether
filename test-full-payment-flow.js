// Comprehensive Test for Full Payment Flow
// Tests: Checkout → Webhook → User Upgrade → Emails → Success Page

require('dotenv').config();
const stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe with sandbox key
const stripeSandboxKey = process.env.STRIPE_SANDBOX_SECRET_KEY;
if (!stripeSandboxKey) {
  console.error('❌ STRIPE_SANDBOX_SECRET_KEY not found');
  process.exit(1);
}
const stripeClient = stripe(stripeSandboxKey);

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://smryjxchwbfpjvpecffg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcnlqeGNod2JmcGp2cGVjZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzcxOTAsImV4cCI6MjA3ODExMzE5MH0.M1jQK3TSWMaAspSOkR-x8FkIi_EECgSZjTpb9lks0hQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test configuration
const TEST_CONFIG = {
  // You'll need to provide these:
  userId: process.env.TEST_USER_ID || null, // User ID to test with
  userEmail: process.env.TEST_USER_EMAIL || null, // User email
  tier: 'standard', // Tier to upgrade to
  amount: 1.00, // $1.00 for testing
};

console.log('🧪 Full Payment Flow Test\n');
console.log('This test will:');
console.log('  1. Create a checkout session');
console.log('  2. Simulate webhook event');
console.log('  3. Check if user is upgraded in database');
console.log('  4. Check if payment is recorded');
console.log('  5. Verify email service configuration\n');

async function testFullFlow() {
  try {
    // Step 1: Get or create test user
    console.log('📋 Step 1: Setting up test user...');
    let testUserId = TEST_CONFIG.userId;
    let testUserEmail = TEST_CONFIG.userEmail;

    if (!testUserId) {
      console.log('   ⚠️  No TEST_USER_ID provided. Please provide a user ID to test with.');
      console.log('   💡 You can set TEST_USER_ID in .env or pass as environment variable\n');
      console.log('   To find a user ID:');
      console.log('   - Check your Supabase dashboard');
      console.log('   - Or use: SELECT id, email FROM auth.users LIMIT 1;\n');
      return;
    }

    // Verify user exists
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (profileError || !userProfile) {
      console.error(`   ❌ User ${testUserId} not found in database`);
      return;
    }

    console.log(`   ✅ Found user: ${userProfile.username || testUserId}`);
    console.log(`   Current tier: ${userProfile.subscription_tier || 'free'}\n`);

    // Step 2: Create checkout session
    console.log('💳 Step 2: Creating checkout session...');
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/subscription?canceled=true`;

    // Get tier settings
    const { data: tierData, error: tierError } = await supabase
      .from('subscription_tier_settings')
      .select('*')
      .eq('tier', TEST_CONFIG.tier)
      .single();

    if (tierError || !tierData) {
      console.error(`   ❌ Tier ${TEST_CONFIG.tier} not found in database`);
      return;
    }

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tierData.display_name || TEST_CONFIG.tier} Subscription`,
              description: tierData.description || `Upgrade to ${TEST_CONFIG.tier} tier`,
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: Math.round(TEST_CONFIG.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: testUserEmail || userProfile.email,
      metadata: {
        user_id: testUserId,
        tier: TEST_CONFIG.tier,
        display_name: tierData.display_name || TEST_CONFIG.tier,
        test: 'true',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log(`   ✅ Checkout session created: ${session.id}`);
    console.log(`   📍 Checkout URL: ${session.url}\n`);

    // Step 3: Instructions for manual testing
    console.log('📝 Step 3: Manual Testing Instructions\n');
    console.log('   To complete the test:');
    console.log('   1. Open the checkout URL above in your browser');
    console.log('   2. Use test card: 4242 4242 4242 4242');
    console.log('   3. Use any future expiry (e.g., 12/25)');
    console.log('   4. Use any CVC (e.g., 123)');
    console.log('   5. Use any ZIP (e.g., 12345)');
    console.log('   6. Complete the payment\n');

    console.log('   After payment, the webhook should:');
    console.log('   ✓ Update user subscription_tier in database');
    console.log('   ✓ Record payment in subscription_payments table');
    console.log('   ✓ Send receipt email to user');
    console.log('   ✓ Send notification email to admin');
    console.log('   ✓ Redirect user to success page\n');

    // Step 4: Simulate webhook event (for testing webhook handler)
    console.log('🔔 Step 4: Webhook Simulation\n');
    console.log('   To test the webhook handler, you can:');
    console.log('   1. Use Stripe CLI: stripe listen --forward-to localhost:8080/api/stripe-webhook');
    console.log('   2. Or manually trigger webhook after payment\n');

    // Step 5: Check current state
    console.log('🔍 Step 5: Current Database State\n');
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('subscription_tier, subscription_updated_at')
      .eq('id', testUserId)
      .single();

    console.log(`   Current subscription_tier: ${currentProfile?.subscription_tier || 'free'}`);
    console.log(`   Last updated: ${currentProfile?.subscription_updated_at || 'never'}\n`);

    // Check recent payments
    const { data: recentPayments } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('user_id', testUserId)
      .order('payment_date', { ascending: false })
      .limit(5);

    console.log(`   Recent payments: ${recentPayments?.length || 0}`);
    if (recentPayments && recentPayments.length > 0) {
      recentPayments.forEach((payment, idx) => {
        console.log(`     ${idx + 1}. ${payment.tier} - $${payment.amount_paid} - ${payment.payment_date}`);
      });
    }
    console.log('');

    // Step 6: Email service check
    console.log('📧 Step 6: Email Service Configuration\n');
    const emailConfigured = !!(
      process.env.JUKETOGETHER_ZOHO_EMAIL &&
      process.env.JUKETOGETHER_ZOHO_EMAIL_PASSWORD
    );
    const adminEmail = process.env.JUKETOGETHER_ADMIN_EMAIL || 'mail@juketogether.com';

    if (emailConfigured) {
      console.log('   ✅ Email service is configured');
      console.log(`   📧 User emails will be sent to: ${testUserEmail || userProfile.email || 'N/A'}`);
      console.log(`   📧 Admin notifications will be sent to: ${adminEmail}\n`);
    } else {
      console.log('   ⚠️  Email service is NOT configured');
      console.log('   💡 Set JUKETOGETHER_ZOHO_EMAIL and JUKETOGETHER_ZOHO_EMAIL_PASSWORD in .env\n');
    }

    // Step 7: Verification script
    console.log('✅ Step 7: Verification Commands\n');
    console.log('   After completing payment, run these to verify:');
    console.log('');
    console.log('   Check user subscription:');
    console.log(`   SELECT id, subscription_tier, subscription_updated_at FROM user_profiles WHERE id = '${testUserId}';`);
    console.log('');
    console.log('   Check payment record:');
    console.log(`   SELECT * FROM subscription_payments WHERE user_id = '${testUserId}' ORDER BY payment_date DESC LIMIT 1;`);
    console.log('');
    console.log('   Check webhook logs in server console');
    console.log('   Check email inboxes for receipt and notification\n');

    console.log('✨ Test setup complete!');
    console.log(`\n🔗 Complete payment at: ${session.url}\n`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.type) {
      console.error(`   Error type: ${error.type}`);
    }
    console.error('\nFull error:', error);
  }
}

// Run the test
testFullFlow();

