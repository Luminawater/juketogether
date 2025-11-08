// Test Stripe connection
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

console.log('🔍 Testing Stripe connection...\n');
console.log(`Using key: ${stripeSecretKey.substring(0, 12)}...${stripeSecretKey.substring(stripeSecretKey.length - 4)}`);
console.log(`Key type: ${stripeSecretKey.startsWith('sk_live_') ? 'LIVE' : stripeSecretKey.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN'}\n`);

// Test connection by fetching account information
async function testStripeConnection() {
  try {
    console.log('📡 Fetching account information...');
    const account = await stripeClient.accounts.retrieve();
    
    console.log('✅ Stripe connection successful!\n');
    console.log('Account Details:');
    console.log(`  - ID: ${account.id}`);
    console.log(`  - Country: ${account.country || 'N/A'}`);
    console.log(`  - Type: ${account.type || 'N/A'}`);
    console.log(`  - Email: ${account.email || 'N/A'}`);
    console.log(`  - Charges Enabled: ${account.charges_enabled ? 'Yes' : 'No'}`);
    console.log(`  - Payouts Enabled: ${account.payouts_enabled ? 'Yes' : 'No'}\n`);
    
    // Test webhook secrets
    console.log('🔐 Checking webhook secrets...');
    const snapshotSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const thinSecret = process.env.STRIPE_WEBHOOK_SECRET_THIN;
    
    if (snapshotSecret) {
      console.log(`  ✅ STRIPE_WEBHOOK_SECRET: ${snapshotSecret.substring(0, 12)}...${snapshotSecret.substring(snapshotSecret.length - 4)}`);
    } else {
      console.log('  ⚠️  STRIPE_WEBHOOK_SECRET: Not set');
    }
    
    if (thinSecret) {
      console.log(`  ✅ STRIPE_WEBHOOK_SECRET_THIN: ${thinSecret.substring(0, 12)}...${thinSecret.substring(thinSecret.length - 4)}`);
    } else {
      console.log('  ⚠️  STRIPE_WEBHOOK_SECRET_THIN: Not set');
    }
    
    // Test publishable key
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY_LIVE;
    if (publishableKey) {
      console.log(`\n📝 STRIPE_PUBLISHABLE_KEY: ${publishableKey.substring(0, 12)}...${publishableKey.substring(publishableKey.length - 4)}`);
    } else {
      console.log('\n⚠️  STRIPE_PUBLISHABLE_KEY: Not set');
    }
    
    console.log('\n✨ All checks passed! Stripe is properly configured.');
    
  } catch (error) {
    console.error('\n❌ Stripe connection failed!\n');
    console.error('Error:', error.message);
    
    if (error.type === 'StripeAuthenticationError') {
      console.error('\n💡 This usually means:');
      console.error('  - Your API key is invalid or expired');
      console.error('  - You\'re using a test key in live mode (or vice versa)');
      console.error('  - The key doesn\'t have the required permissions');
    } else if (error.type === 'StripeAPIError') {
      console.error('\n💡 API Error - Check your Stripe dashboard for more details');
    }
    
    process.exit(1);
  }
}

// Run the test
testStripeConnection();

