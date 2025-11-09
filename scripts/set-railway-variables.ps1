# Railway Environment Variables Setup Script
# Replace placeholder values with your actual credentials before running

# ============================================================================
# STRIPE CONFIGURATION
# ============================================================================
railway variables --set "STRIPE_SECRET_KEY=REPLACE_WITH_YOUR_STRIPE_SECRET_KEY"
railway variables --set "STRIPE_PUBLISHABLE_KEY=REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY"
railway variables --set "STRIPE_WEBHOOK_SECRET=REPLACE_WITH_YOUR_WEBHOOK_SECRET"
railway variables --set "STRIPE_WEBHOOK_SECRET_THIN=REPLACE_WITH_YOUR_WEBHOOK_SECRET_THIN"

# ============================================================================
# SPOTIFY CONFIGURATION
# ============================================================================
railway variables --set "SPOTIFY_CLIENT_ID=REPLACE_WITH_YOUR_SPOTIFY_CLIENT_ID"
railway variables --set "SPOTIFY_CLIENT_SECRET=REPLACE_WITH_YOUR_SPOTIFY_CLIENT_SECRET"
railway variables --set "SPOTIFY_REDIRECT_URI=https://juketogether-production.up.railway.app/spotify/callback"

# ============================================================================
# SUPABASE CONFIGURATION
# ============================================================================
railway variables --set "SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_YOUR_SUPABASE_SERVICE_ROLE_KEY"
railway variables --set "SUPABASE_ANON_KEY=REPLACE_WITH_YOUR_SUPABASE_ANON_KEY"
railway variables --set "SUPABASE_JWT_SECRET_KEY=REPLACE_WITH_YOUR_SUPABASE_JWT_SECRET_KEY"

# ============================================================================
# EMAIL CONFIGURATION (ZOHO)
# ============================================================================
railway variables --set "JUKETOGETHER_ZOHO_EMAIL=REPLACE_WITH_YOUR_ZOHO_EMAIL"
railway variables --set "JUKETOGETHER_ZOHO_EMAIL_PASSWORD=REPLACE_WITH_YOUR_ZOHO_PASSWORD"
railway variables --set "JUKETOGETHER_ADMIN_EMAIL=REPLACE_WITH_YOUR_ADMIN_EMAIL"
railway variables --set "JUKETOGETHER_ZOHO_SMTP_HOST=smtp.zoho.eu"
railway variables --set "JUKETOGETHER_ZOHO_SMTP_PORT=587"
railway variables --set "JUKETOGETHER_ZOHO_SMTP_SECURE=false"

# ============================================================================
# RAPIDAPI CONFIGURATION (Optional)
# ============================================================================
railway variables --set "XRAPID_API_KEY=REPLACE_WITH_YOUR_RAPIDAPI_KEY"
railway variables --set "XRAPID_APP=REPLACE_WITH_YOUR_RAPIDAPI_APP"

Write-Host "✅ All variables set! Remember to replace REPLACE_WITH_* values with actual credentials."






