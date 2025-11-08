# Testing Full Payment Flow

This guide explains how to test the complete payment flow including:
1. ✅ User routing to thank you page
2. ✅ Email sent to user (receipt)
3. ✅ Email sent to admin (notification)
4. ✅ User subscription upgrade in database

## Prerequisites

1. **Sandbox Stripe keys** configured in `.env`:
   - `STRIPE_SANDBOX_SECRET_KEY`
   - `STRIPE_SANDBOX_PUBLISHABLE_KEY`

2. **Email service** configured in `.env`:
   - `JUKETOGETHER_ZOHO_EMAIL`
   - `JUKETOGETHER_ZOHO_EMAIL_PASSWORD`
   - `JUKETOGETHER_ADMIN_EMAIL` (optional, defaults to `mail@juketogether.com`)

3. **Test user ID** - You'll need a user ID from your Supabase database

## Step 1: Set Up Test User

Get a user ID from your database:

```sql
SELECT id, email, username, subscription_tier 
FROM user_profiles 
LIMIT 1;
```

Or set it in `.env`:
```
TEST_USER_ID=your-user-id-here
TEST_USER_EMAIL=user@example.com
```

## Step 2: Create Test Checkout Session

Run the full payment flow test:

```bash
node test-full-payment-flow.js
```

This will:
- Create a checkout session with sandbox keys
- Display the checkout URL
- Show current user state
- Provide verification instructions

## Step 3: Complete the Payment

1. Open the checkout URL in your browser
2. Use Stripe test card: `4242 4242 4242 4242`
3. Use any future expiry date (e.g., `12/25`)
4. Use any 3-digit CVC (e.g., `123`)
5. Use any ZIP code (e.g., `12345`)
6. Complete the payment

## Step 4: Verify Everything Worked

After completing payment, run the verification script:

**PowerShell:**
```powershell
node verify-payment.js cs_test_abc123...
```

**Bash/Linux/Mac:**
```bash
node verify-payment.js cs_test_abc123...
```

Or set `TEST_SESSION_ID` in `.env` and run:
```bash
node verify-payment.js
```

The verification script checks:
- ✅ Stripe session status
- ✅ User subscription tier updated
- ✅ Payment recorded in database
- ✅ Email service configuration

## Step 5: Manual Verification

### Check User Upgrade

```sql
SELECT id, subscription_tier, subscription_updated_at 
FROM user_profiles 
WHERE id = 'your-user-id';
```

### Check Payment Record

```sql
SELECT * 
FROM subscription_payments 
WHERE user_id = 'your-user-id' 
ORDER BY payment_date DESC 
LIMIT 1;
```

### Check Webhook Logs

Check your server console for:
- `Subscription event: customer.subscription.created`
- `Updated subscription tier for user...`
- `Tracked payment for user...`
- `✅ Receipt email sent:`
- `✅ New subscriber notification sent:`

### Check Emails

1. **User email** - Check inbox for receipt email with:
   - Subscription tier
   - Amount paid
   - Payment date
   - Receipt details

2. **Admin email** - Check admin inbox for notification with:
   - New subscriber details
   - User email and name
   - Tier and amount

### Check Success Page

After payment, user should be redirected to:
```
/subscription/success?session_id=cs_test_...
```

The success page should:
- Display receipt information
- Show updated subscription tier
- Allow user to continue

## Troubleshooting

### Webhook Not Processing

If webhook doesn't process:
1. Check webhook secret is configured: `STRIPE_WEBHOOK_SECRET`
2. Check server is running and accessible
3. Use Stripe CLI to forward webhooks locally:
   ```bash
   stripe listen --forward-to localhost:8080/api/stripe-webhook
   ```

### User Not Upgraded

If user tier didn't update:
1. Check webhook logs for errors
2. Verify subscription metadata includes `user_id` and `tier`
3. Check Supabase connection and permissions

### Emails Not Sent

If emails aren't sent:
1. Verify email service is configured in `.env`
2. Check SMTP credentials are correct
3. Check server logs for email errors
4. Verify email addresses are valid

### Success Page Not Loading

If success page doesn't work:
1. Check `FRONTEND_URL` is set correctly
2. Verify route exists: `/subscription/success`
3. Check session ID is passed correctly
4. Verify user is authenticated

## Test Scripts

- **`test-sandbox-payment.js`** - Quick sandbox payment test
- **`test-full-payment-flow.js`** - Complete flow test with setup
- **`verify-payment.js`** - Post-payment verification

## Notes

- All tests use **sandbox/test keys** - no real money is charged
- Test cards work in sandbox mode only
- Webhooks may take a few seconds to process
- Emails may be delayed depending on SMTP service

