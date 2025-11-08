# Connecting GoDaddy Domain to Railway

This guide will help you connect your GoDaddy domain to your Railway deployment.

## Prerequisites

- A GoDaddy domain
- A Railway account with your project deployed
- Access to your GoDaddy DNS settings
- Railway CLI installed (optional, but helpful)

## Railway Domain Setup Overview

**Important:** Railway does NOT provide DNS management. Unlike Vercel (which provides nameservers), Railway only provides:
- Railway-provided domains (e.g., `your-service.up.railway.app`)
- A CNAME target value that you add to YOUR DNS provider

You must manage DNS through your existing provider (GoDaddy) or switch to a provider that supports CNAME flattening (like Cloudflare).

**GoDaddy Limitations:** According to [Railway's official documentation](https://docs.railway.com/guides/public-networking), **GoDaddy does NOT support CNAME flattening or dynamic ALIAS records** at the root domain level. This means:

- ✅ You CAN use subdomains like `www.yourdomain.com` with CNAME records in GoDaddy
- ❌ You CANNOT use root domain `yourdomain.com` directly with CNAME in GoDaddy
- ✅ **Workaround**: Change your domain's nameservers to Cloudflare (free) to enable root domain support

## Method 1: Using www Subdomain (Recommended)

This is the easiest method for GoDaddy domains.

### Step 1: Install Railway CLI (Optional but Recommended)

```bash
npm install -g @railway/cli
```

Or using the installer:
- Windows: Download from https://docs.railway.com/guides/cli
- Or use: `npm install -g @railway/cli`

### Step 2: Login to Railway

```bash
railway login
```

### Step 3: Link Your Project

If you haven't already linked your project:

```bash
railway link
```

This will create a `.railway` directory with project configuration.

### Step 4: Generate Domain in Railway

You can generate a domain using Railway CLI:

```bash
railway domain
```

Or via Railway Dashboard:
1. Go to your Railway project dashboard
2. Select your service
3. Go to **Settings** → **Networking**
4. Click **+ Custom Domain**
5. Enter your domain: `www.yourdomain.com`
6. Railway will provide a CNAME value (e.g., `your-service.up.railway.app`)

### Step 5: Configure DNS in GoDaddy

1. Log in to your GoDaddy account
2. Go to **My Products** → **Domains**
3. Click on your domain name
4. Scroll to **DNS** or **Manage DNS**
5. Click **Add** to create a new record
6. Add a **CNAME Record**:
   - **Type**: CNAME
   - **Name**: `www` (or your desired subdomain)
   - **Value**: The CNAME value Railway provided (e.g., `your-service.up.railway.app`)
   - **TTL**: 600 (or 1 hour)
7. Click **Save**

### Step 6: Verify Domain in Railway

1. Go back to Railway dashboard
2. In your service settings → Networking → Custom Domains
3. Click **Verify** next to your domain
4. Railway will check DNS configuration
5. Once verified, Railway automatically provisions an SSL certificate

### Step 7: Set Up Root Domain Redirect (Optional)

Since GoDaddy doesn't support CNAME at root, you can redirect `yourdomain.com` to `www.yourdomain.com`:

1. In GoDaddy, go to your domain settings
2. Find **Domain Forwarding** or **Redirects**
3. Add a redirect:
   - **From**: `yourdomain.com`
   - **To**: `www.yourdomain.com`
   - **Type**: Permanent (301) or Temporary (302)
4. Save

---

## Method 2: Using Cloudflare for DNS Management (Recommended for Root Domain)

**Railway does NOT provide DNS management.** If you want to use your root domain (`yourdomain.com`) with Railway, you need to use a DNS provider that supports CNAME flattening. The official Railway documentation recommends Cloudflare (free), which allows you to manage DNS while keeping your domain registered at GoDaddy.

### Why Cloudflare?

According to [Railway's documentation](https://docs.railway.com/guides/public-networking), these providers **DO support** root domain CNAME:
- ✅ Cloudflare (CNAME - free)
- ✅ DNSimple (ALIAS)
- ✅ Namecheap (CNAME)
- ✅ bunny.net (ANAME)

These providers **DO NOT support** root domain CNAME:
- ❌ GoDaddy
- ❌ AWS Route 53
- ❌ Hostinger
- ❌ NameSilo
- ❌ Hurricane Electric
- ❌ SquareSpace

### Steps to Use Cloudflare with GoDaddy Domain:

1. **Sign up for Cloudflare** (free): https://dash.cloudflare.com/sign-up
2. **Add your domain to Cloudflare**:
   - Go to Cloudflare Dashboard → Add Site
   - Enter your domain
   - Cloudflare will scan your existing DNS records
3. **Get Cloudflare Nameservers**:
   - Cloudflare will provide nameservers like:
     - `ns1.cloudflare.com`
     - `ns2.cloudflare.com`
4. **Update Nameservers in GoDaddy**:
   - Go to GoDaddy → My Products → Domains → Your Domain
   - Scroll to **Nameservers** section
   - Click **Change**
   - Select **Custom**
   - Replace with Cloudflare nameservers
   - Save
5. **Add Railway CNAME in Cloudflare**:
   - In Cloudflare DNS settings
   - Add CNAME record:
     - **Name**: `@` (for root domain)
     - **Target**: Railway's CNAME value (e.g., `abc123.up.railway.app`)
     - **Proxy status**: ON (orange cloud)
6. **Configure SSL in Cloudflare**:
   - Go to SSL/TLS → Overview
   - Set to **Full** (NOT Full Strict)
   - Enable Universal SSL
7. **Add Domain in Railway**:
   - Railway Dashboard → Service → Settings → Networking
   - Click **+ Custom Domain**
   - Enter: `yourdomain.com`
   - Railway will provide CNAME value
   - Add CNAME record in Cloudflare as above

**Note:** This method allows you to use both `yourdomain.com` and `www.yourdomain.com` with proper SSL certificates.

---

## Method 3: Using A Records (Not Supported)

According to Railway's documentation, Railway does not support static IP addresses. Railway uses dynamic infrastructure, so **A records are not an option**. You must use CNAME records.

If you need root domain support with GoDaddy, you must use Method 2 (Cloudflare nameservers).

---

## Troubleshooting

### Domain Not Verifying

1. **Check DNS Propagation**:
   - Use tools like `whatsmydns.net` or `dnschecker.org`
   - Search for `www.yourdomain.com` and check CNAME records
   - Verify the CNAME points to Railway's domain

2. **Double-check Records**:
   - Ensure CNAME record name is exactly `www` (or your subdomain)
   - Ensure CNAME value matches Railway's provided value exactly
   - Check for typos in record values
   - Remove any conflicting A or CNAME records

3. **Wait for Propagation**:
   - DNS changes can take 24-72 hours to propagate globally
   - Usually works within a few hours
   - Some regions may update faster than others

4. **Verify Railway Service**:
   - Ensure your Railway service is running
   - Check Railway logs for any errors
   - Verify the service is publicly accessible

### SSL Certificate Issues

- Railway automatically provisions SSL certificates via Let's Encrypt
- This happens automatically after domain verification
- Can take a few minutes to a few hours after verification
- If SSL fails, check that DNS is properly configured

### Root Domain Issues

If you need `yourdomain.com` (without www) to work:

1. **Option 1**: Use domain forwarding in GoDaddy (redirect to www)
2. **Option 2**: Transfer DNS to Cloudflare and use CNAME flattening
3. **Option 3**: Use Railway's API to check if they support ALIAS records

### Subdomain Setup

To add additional subdomains (e.g., `api.yourdomain.com`):

1. In Railway, add the subdomain: `api.yourdomain.com`
2. In GoDaddy DNS, add a CNAME record:
   - **Name**: `api`
   - **Value**: Railway's CNAME value (same as www)
   - **TTL**: 600

---

## Quick Reference

### Railway CLI Commands

```bash
# Login to Railway
railway login

# Link project
railway link

# Generate domain
railway domain

# List projects
railway list

# View service logs
railway logs

# Deploy
railway up
```

### Common DNS Records

**WWW Subdomain (CNAME)**:
- Type: CNAME
- Name: www
- Value: `your-service.up.railway.app` (from Railway)
- TTL: 600

**Root Domain Redirect** (in GoDaddy):
- From: `yourdomain.com`
- To: `www.yourdomain.com`
- Type: Permanent (301)

---

## Environment Variables

After setting up Railway, update your environment variables:

1. In Railway Dashboard → Service → Variables
2. Add all your environment variables from `.env` or `env.replicated`
3. Railway automatically provides:
   - `PORT` (if not set, defaults to available port)
   - `RAILWAY_ENVIRONMENT` (production, preview, etc.)

### Important Variables to Set:

```bash
# Your existing variables
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
SPOTIFY_CLIENT_ID=...
# ... etc

# Railway-specific (optional)
PORT=8080  # If your app needs a specific port
NODE_ENV=production
```

---

## Deployment Configuration

### Railway Configuration File (Optional)

You can create a `railway.json` or `railway.toml` file:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Or `railway.toml`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

---

## Migration from Vercel to Railway

If you're migrating from Vercel:

1. **Export Environment Variables**:
   - Copy all environment variables from Vercel dashboard
   - Add them to Railway service variables

2. **Update API URLs**:
   - Update `app.json` in `SoundCloudJukeboxMobile`:
   ```json
   "extra": {
     "apiUrl": "https://www.yourdomain.com",
     "socketUrl": "https://www.yourdomain.com"
   }
   ```

3. **Update Webhook URLs**:
   - Update Stripe webhook URLs to point to Railway domain
   - Update any other webhook configurations

4. **Test Deployment**:
   - Deploy to Railway
   - Test all endpoints
   - Verify Socket.io connections
   - Test Stripe webhooks

---

## Additional Notes

- **Railway Pricing**: Railway offers a free tier with $5 credit monthly. Check pricing at https://railway.app/pricing
- **Domain Limits**: 
  - Trial Plan: 1 custom domain per service
  - Hobby Plan: 2 custom domains per service
  - Pro Plan: 20 domains per service (can be increased on request)
- **Auto-Deploy**: Railway can auto-deploy from GitHub (similar to Vercel)
- **Environment Variables**: Railway supports environment-specific variables
- **Logs**: Railway provides real-time logs in the dashboard
- **Metrics**: Railway shows CPU, memory, and network usage
- **SSL Certificates**: Railway automatically provisions Let's Encrypt certificates for all custom domains
- **Port Configuration**: Railway automatically detects your app's port from the `PORT` environment variable

## Official Railway Documentation

For the most up-to-date information, refer to:
- [Railway Public Networking Guide](https://docs.railway.com/guides/public-networking)
- [Railway Custom Domains](https://docs.railway.com/guides/public-networking#custom-domains)

---

## Need Help?

- **Railway Documentation**: 
  - [Public Networking Guide](https://docs.railway.com/guides/public-networking)
  - [Fixing Common Errors](https://docs.railway.com/guides/fixing-common-errors)
- **Railway Discord**: https://discord.gg/railway
- **GoDaddy Support**: https://www.godaddy.com/help
- **Cloudflare Setup**: https://developers.cloudflare.com/dns/zone-setups/full-setup/
- **Check DNS propagation**: https://www.whatsmydns.net/

---

## Comparison: Railway vs Vercel

| Feature | Railway | Vercel |
|---------|---------|--------|
| Root Domain CNAME | ❌ (needs workaround) | ✅ (via A records) |
| SSL Certificates | ✅ Auto (Let's Encrypt) | ✅ Auto (Let's Encrypt) |
| WebSocket Support | ✅ Native | ✅ (with config) |
| Serverless Functions | ❌ | ✅ |
| Full Node.js Apps | ✅ | ⚠️ (limited) |
| Database Hosting | ✅ | ❌ |
| Pricing Model | Usage-based | Free tier + Pro |

For your use case (Node.js + Socket.io), Railway is a better fit than Vercel!

