# Connecting GoDaddy Domain to Vercel

This guide will help you connect your GoDaddy domain to your Vercel deployment.

## Prerequisites

- A GoDaddy domain
- A Vercel account with your project deployed
- Access to your GoDaddy DNS settings

## Method 1: Using Vercel Nameservers (Recommended - Easiest)

This is the easiest method as Vercel will manage all DNS records automatically.

### Step 1: Add Domain in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter your domain (e.g., `yourdomain.com`)
5. Click **Add**

### Step 2: Get Vercel Nameservers

1. In the domain settings, Vercel will show you nameservers like:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
   - `ns3.vercel-dns.com`

### Step 3: Update Nameservers in GoDaddy

1. Log in to your GoDaddy account
2. Go to **My Products** → **Domains**
3. Click on your domain name
4. Scroll down to **Additional Settings** → **Manage DNS**
5. Scroll to the **Nameservers** section
6. Click **Change**
7. Select **Custom** (instead of "GoDaddy Nameservers")
8. Replace the existing nameservers with Vercel's nameservers:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
   - `ns3.vercel-dns.com`
9. Click **Save**

### Step 4: Wait for Propagation

- DNS changes can take 24-48 hours to propagate
- Usually works within a few hours
- Vercel will automatically verify your domain once DNS propagates

---

## Method 2: Using DNS Records (Keep GoDaddy Nameservers)

If you prefer to keep GoDaddy's nameservers, you can add DNS records manually.

### Step 1: Add Domain in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter your domain (e.g., `yourdomain.com`)
5. Click **Add**

### Step 2: Get DNS Configuration from Vercel

1. In the domain settings, Vercel will show you the required DNS records
2. You'll see different options depending on whether you're setting up:
   - **Root domain** (`yourdomain.com`) - Use A records
   - **Subdomain** (`www.yourdomain.com`) - Use CNAME record

### Step 3: Add DNS Records in GoDaddy

#### For Root Domain (yourdomain.com):

1. Log in to GoDaddy
2. Go to **My Products** → **Domains**
3. Click on your domain → **DNS** (or **Manage DNS**)
4. Click **Add** to create a new record
5. Add an **A Record**:
   - **Type**: A
   - **Name**: `@` (or leave blank for root domain)
   - **Value**: Vercel's IP address (Vercel will show you this, typically `76.76.21.21`)
   - **TTL**: 600 (or 1 hour)
6. Click **Save**

**Note**: For root domains, Vercel may provide multiple A records. Add all of them.

#### For WWW Subdomain (www.yourdomain.com):

1. In the same DNS management page
2. Click **Add** to create a new record
3. Add a **CNAME Record**:
   - **Type**: CNAME
   - **Name**: `www`
   - **Value**: `cname.vercel-dns.com` (or the value Vercel provides)
   - **TTL**: 600 (or 1 hour)
4. Click **Save**

### Step 4: Verify Domain in Vercel

1. Go back to Vercel dashboard
2. In your domain settings, click **Verify**
3. Vercel will check if DNS records are configured correctly
4. Wait for DNS propagation (can take up to 48 hours)

---

## Troubleshooting

### Domain Not Verifying

1. **Check DNS Propagation**:
   - Use tools like `whatsmydns.net` or `dnschecker.org`
   - Search for your domain and check if records are propagated globally

2. **Double-check Records**:
   - Ensure A records point to the correct IP addresses
   - Ensure CNAME records point to `cname.vercel-dns.com`
   - Check for typos in record values

3. **Wait Longer**:
   - DNS changes can take 24-48 hours
   - Some regions may update faster than others

4. **Remove Conflicting Records**:
   - Delete any old A or CNAME records that might conflict
   - Ensure only the Vercel records exist

### SSL Certificate Issues

- Vercel automatically provisions SSL certificates via Let's Encrypt
- This happens automatically after domain verification
- Can take a few minutes to a few hours after verification

### Subdomain Setup

To add a subdomain (e.g., `app.yourdomain.com`):

1. In Vercel, add the subdomain: `app.yourdomain.com`
2. In GoDaddy DNS, add a CNAME record:
   - **Name**: `app`
   - **Value**: `cname.vercel-dns.com`
   - **TTL**: 600

---

## Quick Reference

### Vercel Nameservers (Method 1)
```
ns1.vercel-dns.com
ns2.vercel-dns.com
ns3.vercel-dns.com
```

### Common DNS Records (Method 2)

**Root Domain (A Record)**:
- Type: A
- Name: @
- Value: `76.76.21.21` (check Vercel dashboard for current IPs)

**WWW Subdomain (CNAME)**:
- Type: CNAME
- Name: www
- Value: `cname.vercel-dns.com`

---

## Additional Notes

- **Method 1 (Nameservers)** is recommended because:
  - Vercel manages all DNS automatically
  - Easier to set up
  - Less chance of configuration errors
  - Automatic SSL certificate provisioning

- **Method 2 (DNS Records)** is useful if:
  - You need to keep other DNS records on GoDaddy
  - You're using other services that require GoDaddy DNS
  - You prefer more control over DNS settings

---

## Need Help?

- Vercel Documentation: https://vercel.com/docs/concepts/projects/domains
- GoDaddy Support: https://www.godaddy.com/help
- Check DNS propagation: https://www.whatsmydns.net/

