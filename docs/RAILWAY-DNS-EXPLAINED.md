# Railway DNS Explained

## Does Railway Provide DNS?

**No.** Railway does NOT provide DNS management or nameservers.

### What Railway Provides:
- ✅ Railway-provided domains (e.g., `your-service.up.railway.app`)
- ✅ A CNAME target value when you add a custom domain
- ✅ Automatic SSL certificate provisioning (Let's Encrypt)

### What Railway Does NOT Provide:
- ❌ DNS hosting/management
- ❌ Nameservers (like Vercel provides)
- ❌ DNS record management interface

## How It Works

1. **You add a custom domain in Railway:**
   - Railway Dashboard → Service → Settings → Networking → + Custom Domain
   - Enter: `www.yourdomain.com`
   - Railway provides a CNAME value: `abc123.up.railway.app`

2. **You add the CNAME record in YOUR DNS provider:**
   - Go to GoDaddy (or your DNS provider)
   - Add CNAME record:
     - **Name**: `www`
     - **Value**: `abc123.up.railway.app` (from Railway)
   - Save

3. **Railway verifies and provisions SSL:**
   - Railway checks DNS propagation
   - Once verified, Railway automatically issues SSL certificate
   - Your domain is live!

## Comparison: Railway vs Vercel

| Feature | Railway | Vercel |
|---------|---------|--------|
| DNS Management | ❌ No | ✅ Yes (nameservers) |
| CNAME Target | ✅ Provides value | ✅ Provides value |
| SSL Certificates | ✅ Auto (Let's Encrypt) | ✅ Auto (Let's Encrypt) |
| Root Domain Support | ⚠️ Depends on DNS provider | ✅ Via A records |

## Your Options with GoDaddy

### Option 1: Use www Subdomain (Easiest)
- Add CNAME in GoDaddy: `www` → Railway's CNAME value
- Set up redirect: `yourdomain.com` → `www.yourdomain.com`
- ✅ Works immediately
- ❌ Root domain requires redirect

### Option 2: Use Cloudflare for DNS (Best for Root Domain)
- Keep domain registered at GoDaddy
- Change nameservers to Cloudflare
- Add CNAME in Cloudflare: `@` → Railway's CNAME value
- ✅ Root domain works directly
- ✅ Free DNS management
- ✅ Better performance (CDN)

## The CNAME Record Explained

A CNAME (Canonical Name) record is a DNS record that points one domain name to another domain name.

**Example:**
```
www.yourdomain.com  →  CNAME  →  abc123.up.railway.app
```

When someone visits `www.yourdomain.com`:
1. DNS lookup finds the CNAME record
2. DNS resolves `abc123.up.railway.app` to Railway's IP
3. Request goes to Railway
4. Railway routes to your service

## Why GoDaddy Doesn't Support Root CNAME

According to DNS standards (RFC 1912), root domains should use A or AAAA records (IP addresses), not CNAME records. However, Railway uses dynamic infrastructure without static IPs, so CNAME is required.

Some DNS providers (Cloudflare, Namecheap) support "CNAME flattening" which allows CNAME-like behavior at the root. GoDaddy does not support this.

## Summary

- Railway provides the CNAME **target value**
- You manage DNS in your provider (GoDaddy, Cloudflare, etc.)
- For root domain with GoDaddy, use Cloudflare nameservers
- For subdomain with GoDaddy, use CNAME directly

