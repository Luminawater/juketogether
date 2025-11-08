// Verify Payment Flow After Completion
// Run this after completing a test payment to verify everything worked

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe');

// Initialize
const stripeSandboxKey = process.env.STRIPE_SANDBOX_SECRET_KEY;
if (!stripeSandboxKey) {
  console.error('❌ STRIPE_SANDBOX_SECRET_KEY not found');
  process.exit(1);
}
const stripeClient = stripe(stripeSandboxKey);

const supabaseUrl = process.env.SUPABASE_URL || 'https://smryjxchwbfpjvpecffg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcnlqeGNod2JmcGp2cGVjZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzcxOTAsImV4cCI6MjA3ODExMzE5MH0.M1jQK3TSWMaAspSOkR-x8FkIi_EECgSZjTpb9lks0hQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// Get session ID from command line or use test
const sessionId = process.argv[2] || process.env.TEST_SESSION_ID;

if (!sessionId) {
  console.log('Usage: node verify-payment.js <session_id>');
  console.log('   Or set TEST_SESSION_ID in .env\n');
  console.log('PowerShell Example:');
  console.log('   node verify-payment.js cs_test_a1Wv286I5oPwWJUNfXw3ZHPq6x15kDhQX7I9sg0WI2bzkTX3iCkRkzxf8m\n');
  console.log('Bash/Linux/Mac Example:');
  console.log('   node verify-payment.js cs_test_a1Wv286I5oPwWJUNfXw3ZHPq6x15kDhQX7I9sg0WI2bzkTX3iCkRkzxf8m\n');
  process.exit(1);
}

async function verifyPayment() {
  console.log('🔍 Verifying Payment Flow\n');
  console.log(`Session ID: ${sessionId}\n`);

  try {
    // Step 1: Get session from Stripe
    console.log('📋 Step 1: Fetching Stripe session...');
    const session = await stripeClient.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'payment_intent']
    });

    console.log(`   ✅ Session found: ${session.id}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Payment Status: ${session.payment_status}`);
    console.log(`   Mode: ${session.mode}`);
    console.log(`   Amount Total: $${(session.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()}`);
    
    if (session.metadata) {
      console.log(`   Metadata:`);
      console.log(`     - user_id: ${session.metadata.user_id || 'N/A'}`);
      console.log(`     - tier: ${session.metadata.tier || 'N/A'}`);
    }

    if (session.subscription) {
      const subscription = typeof session.subscription === 'string' 
        ? await stripeClient.subscriptions.retrieve(session.subscription)
        : session.subscription;
      console.log(`   Subscription ID: ${subscription.id}`);
      console.log(`   Subscription Status: ${subscription.status}`);
    }
    console.log('');

    // Step 2: Check user upgrade
    if (session.metadata?.user_id) {
      const userId = session.metadata.user_id;
      const expectedTier = session.metadata.tier;

      console.log('👤 Step 2: Checking user upgrade...');
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('subscription_tier, subscription_updated_at, username, email')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.log(`   ❌ Error fetching user: ${profileError.message}`);
      } else if (!userProfile) {
        console.log(`   ❌ User ${userId} not found`);
      } else {
        console.log(`   ✅ User found: ${userProfile.username || userId}`);
        console.log(`   Current tier: ${userProfile.subscription_tier || 'free'}`);
        console.log(`   Expected tier: ${expectedTier || 'N/A'}`);
        
        if (userProfile.subscription_tier === expectedTier) {
          console.log(`   ✅ User tier matches expected tier!`);
        } else {
          console.log(`   ⚠️  User tier does NOT match expected tier`);
          console.log(`   💡 Webhook may not have processed yet, or there was an error`);
        }
        
        if (userProfile.subscription_updated_at) {
          console.log(`   Last updated: ${new Date(userProfile.subscription_updated_at).toLocaleString()}`);
        }
      }
      console.log('');

      // Step 3: Check payment record
      console.log('💰 Step 3: Checking payment record...');
      const { data: payments, error: paymentError } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('user_id', userId)
        .order('payment_date', { ascending: false })
        .limit(1);

      if (paymentError) {
        console.log(`   ❌ Error fetching payments: ${paymentError.message}`);
      } else if (!payments || payments.length === 0) {
        console.log(`   ⚠️  No payment record found in database`);
        console.log(`   💡 Webhook may not have processed yet`);
      } else {
        const payment = payments[0];
        console.log(`   ✅ Payment record found:`);
        console.log(`     - Tier: ${payment.tier}`);
        console.log(`     - Amount: $${payment.amount_paid}`);
        console.log(`     - Currency: ${payment.currency || 'USD'}`);
        console.log(`     - Payment Date: ${new Date(payment.payment_date).toLocaleString()}`);
        console.log(`     - Provider: ${payment.payment_provider}`);
        console.log(`     - Provider ID: ${payment.payment_provider_id}`);
      }
      console.log('');

      // Step 4: Check webhook processing
      console.log('🔔 Step 4: Webhook Processing Status\n');
      console.log('   Check your server logs for webhook events:');
      console.log('   - Look for "Subscription event: customer.subscription.created"');
      console.log('   - Look for "Updated subscription tier for user..."');
      console.log('   - Look for "Tracked payment for user..."');
      console.log('   - Look for email sending confirmations\n');

      // Step 5: Email verification
      console.log('📧 Step 5: Email Verification\n');
      const emailConfigured = !!(
        process.env.JUKETOGETHER_ZOHO_EMAIL &&
        process.env.JUKETOGETHER_ZOHO_EMAIL_PASSWORD
      );
      const adminEmail = process.env.JUKETOGETHER_ADMIN_EMAIL || 'mail@juketogether.com';

      if (emailConfigured) {
        console.log('   ✅ Email service is configured');
        console.log(`   📧 Check inbox: ${userProfile?.email || session.customer_email || 'N/A'}`);
        console.log(`   📧 Check admin inbox: ${adminEmail}`);
        console.log('   Look for:');
        console.log('     - Receipt email to user');
        console.log('     - New subscriber notification to admin\n');
      } else {
        console.log('   ⚠️  Email service is NOT configured');
        console.log('   💡 Emails will not be sent\n');
      }

      // Step 6: Success page routing
      console.log('🌐 Step 6: Success Page Routing\n');
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const successUrl = `${baseUrl}/subscription/success?session_id=${sessionId}`;
      console.log(`   Success URL: ${successUrl}`);
      console.log('   ✅ User should be redirected here after payment');
      console.log('   ✅ Success page should display receipt and updated tier\n');

      // Summary
      console.log('📊 Summary\n');
      const checks = {
        'Stripe Session': session.status === 'complete' && session.payment_status === 'paid',
        'User Upgrade': userProfile?.subscription_tier === expectedTier,
        'Payment Record': payments && payments.length > 0,
        'Email Service': emailConfigured,
      };

      Object.entries(checks).forEach(([check, passed]) => {
        console.log(`   ${passed ? '✅' : '❌'} ${check}`);
      });

      if (Object.values(checks).every(v => v)) {
        console.log('\n✨ All checks passed! Payment flow is working correctly.\n');
      } else {
        console.log('\n⚠️  Some checks failed. Review the details above.\n');
      }

    } else {
      console.log('   ⚠️  No user_id in session metadata');
      console.log('   💡 Cannot verify user upgrade without user_id\n');
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    if (error.type) {
      console.error(`   Error type: ${error.type}`);
    }
  }
}

verifyPayment();

