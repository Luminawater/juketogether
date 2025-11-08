# Railway Quick Start Guide

This guide will help you quickly set up your project on Railway and connect your GoDaddy domain.

## Using Railway MCP Tools

This project has Railway MCP integration! Once you're logged in, you can ask the AI assistant to:
- Generate domains
- Set environment variables
- Deploy code
- View logs
- And more!

See `docs/RAILWAY-MCP-USAGE.md` for details.

---

## Step 1: Install Railway CLI

### Windows (PowerShell)

```powershell
# Option 1: Using npm (if you have Node.js)
npm install -g @railway/cli

# Option 2: Using Scoop (if installed)
scoop install railway

# Option 3: Download installer
# Visit: https://docs.railway.com/guides/cli
```

### Verify Installation

```bash
railway --version
```

## Step 2: Login to Railway

```bash
railway login
```

This will open your browser for authentication. No token needed!

## Step 3: Create or Link Project

### Option A: Create New Project

```bash
railway init
```

Follow the prompts to create a new project.

### Option B: Link Existing Project

If you already have a Railway project:

```bash
railway link
```

Select your project from the list.

## Step 4: Deploy Your Service

Railway will automatically detect your `package.json` and `server.js`:

```bash
railway up
```

Or deploy from GitHub:
1. Connect your GitHub repo in Railway dashboard
2. Railway will auto-deploy on push

## Step 5: Set Environment Variables

### Via CLI:

```bash
railway variables set STRIPE_SECRET_KEY=your_key_here
railway variables set SPOTIFY_CLIENT_ID=your_id_here
# ... add all your variables
```

### Via Dashboard:

1. Go to Railway Dashboard
2. Select your service
3. Go to **Variables** tab
4. Add all variables from your `.env` file

**Important Variables to Set:**
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- All other variables from `env.replicated`

## Step 6: Generate Domain

### Via CLI:

```bash
railway domain
```

This will generate a Railway domain like `your-service.up.railway.app`

### Via Dashboard:

1. Go to your service → **Settings** → **Networking**
2. Click **+ Custom Domain**
3. Enter: `www.yourdomain.com`
4. Railway will show you a CNAME value

## Step 7: Configure GoDaddy DNS

1. Log in to GoDaddy
2. Go to **My Products** → **Domains** → Your Domain
3. Click **DNS** or **Manage DNS**
4. Click **Add** record
5. Add CNAME:
   - **Type**: CNAME
   - **Name**: `www`
   - **Value**: `your-service.up.railway.app` (from Railway)
   - **TTL**: 600
6. Save

## Step 8: Verify Domain

1. Wait 5-10 minutes for DNS to propagate
2. In Railway Dashboard → Service → Settings → Networking
3. Click **Verify** next to your domain
4. Railway will automatically provision SSL certificate

## Step 9: Set Up Root Domain Redirect (Optional)

Since GoDaddy doesn't support root CNAME:

1. In GoDaddy → Domain Settings
2. Find **Domain Forwarding** or **Redirects**
3. Add redirect:
   - **From**: `yourdomain.com`
   - **To**: `www.yourdomain.com`
   - **Type**: Permanent (301)

## Step 10: Update App Configuration

Update your mobile app configuration:

**File**: `SoundCloudJukeboxMobile/app.json`

```json
{
  "extra": {
    "apiUrl": "https://www.yourdomain.com",
    "socketUrl": "https://www.yourdomain.com"
  }
}
```

## Step 11: Update Stripe Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Update webhook URL to: `https://www.yourdomain.com/api/stripe-webhook`
3. Test the webhook

## Troubleshooting

### Railway CLI Not Found

```bash
# Reinstall
npm install -g @railway/cli

# Or use npx
npx @railway/cli login
```

### Domain Not Verifying

1. Check DNS propagation: https://www.whatsmydns.net/
2. Verify CNAME record is correct
3. Wait up to 24 hours for full propagation

### Service Not Starting

1. Check Railway logs: `railway logs`
2. Verify PORT is set correctly (Railway sets this automatically)
3. Check environment variables are set

### Socket.io Not Working

1. Ensure CORS is configured in `server.js` (already done)
2. Verify Socket.io path is accessible
3. Check Railway logs for connection errors

## Useful Railway Commands

```bash
# View logs
railway logs

# View variables
railway variables

# Open dashboard
railway open

# Deploy
railway up

# Generate domain
railway domain

# List projects
railway list
```

## Next Steps

- See `docs/RAILWAY-DOMAIN-SETUP.md` for detailed domain setup
- Monitor your service in Railway dashboard
- Set up auto-deploy from GitHub
- Configure monitoring and alerts

