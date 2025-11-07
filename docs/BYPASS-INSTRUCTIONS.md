# How to Bypass Localtunnel Password

Unfortunately, localtunnel shows a password page that can't be fully bypassed from the server side. However, here are solutions:

## Option 1: Browser Extension (Recommended)

Install a browser extension that can modify request headers:

**Chrome/Edge:**
- "ModHeader" extension
- Add header: `bypass-tunnel-reminder: true`
- Or change User-Agent to: `SoundCloud-Jukebox-Client/1.0`

**Firefox:**
- "Modify Headers" extension
- Add header: `bypass-tunnel-reminder: true`

## Option 2: Share the Password

The password is your public IP. Get it with:
```bash
curl https://loca.lt/mytunnelpassword
```

Share both the URL and password with visitors. They only need to enter it once per IP every 7 days.

## Option 3: Use ngrok Instead

ngrok doesn't require passwords (but needs a free account):

```bash
npx --yes ngrok http 8080
```

Sign up at https://ngrok.com (free tier available)

## Option 4: Accept the Password Page

The password page only appears once per visitor's IP address every 7 days. After the first visit, they won't see it again.

