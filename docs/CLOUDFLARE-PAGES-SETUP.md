# Cloudflare Pages Deployment Guide

This guide explains how to deploy JukeTogether to Cloudflare Pages.

## Project Configuration

- **Project Name**: juketogether
- **Production Branch**: main
- **Framework**: Expo (React Native Web)
- **Build Output Directory**: `web-build`

## Cloudflare Pages Setup

### 1. Connect Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository: `Luminawater/juketogether`
4. Select the repository and click **Begin setup**

### 2. Build Configuration

Configure the following settings in Cloudflare Pages:

#### Framework Preset
- **Framework preset**: `None` or `Create React App` (Expo web is similar)
  - Note: Cloudflare doesn't have a specific Expo preset, so use a generic static site preset

#### Build Settings
- **Build command** (recommended):
  ```bash
  cd SoundCloudJukeboxMobile && npm install && npx --yes expo export -p web --output-dir ../web-build && cd .. && echo "/*    /index.html   200" > web-build/_redirects
  ```

- **Alternative build command** (if the above fails):
  ```bash
  npm run build:cloudflare:direct
  ```

- **Build output directory**: `web-build`
- **Root directory**: `/` (leave empty or set to root)

#### Environment Variables

Add the following environment variables in Cloudflare Pages:

- `NODE_VERSION`: `18` or `20` (recommended)
- `EXPO_PUBLIC_SOCKET_URL`: Your WebSocket server URL (optional)
  - **Default**: Uses the API URL from `app.json` (`https://juketogether.vercel.app`)
  - **Note**: Vercel serverless functions have limited WebSocket support
  - If you need full WebSocket support, deploy a separate WebSocket server (e.g., on Railway, Render, or Fly.io)
  - Then set this variable to your WebSocket server URL

### 3. Build Scripts

The project includes build scripts for Cloudflare Pages:

- `build:cloudflare`: Standard build (may have npm chaining issues on Cloudflare)
- `build:cloudflare:direct`: Direct build command (recommended for Cloudflare Pages)

```json
"build:cloudflare": "npm run build:web && node scripts/copy-redirects.js",
"build:cloudflare:direct": "cd SoundCloudJukeboxMobile && npm install && npx --yes expo export -p web --output-dir ../web-build && cd .. && node scripts/copy-redirects.js && echo \"/*    /index.html   200\" > web-build/_redirects"
```

### 4. SPA Routing and Headers

The build process automatically creates two files in `web-build`:

1. **`_redirects`**: Ensures all routes serve `index.html` for client-side routing:
   ```
   /*    /index.html   200
   ```

2. **`_headers`**: Sets correct MIME types for fonts and assets (fixes icon display issues):
   - Font files (`.ttf`, `.woff`, `.woff2`) with proper `Content-Type`
   - CORS headers for cross-origin requests
   - Cache headers for optimal performance

These files are automatically created during the build process from templates.

## Deployment Process

### Automatic Deployments

Cloudflare Pages will automatically:
1. Deploy on every push to the `main` branch
2. Create preview deployments for pull requests
3. Build using the configured build command

### Manual Deployment

You can also trigger deployments manually:
1. Go to your project in Cloudflare Pages
2. Click **Deployments** → **Retry deployment** or **Create deployment**

## Custom Domain

### Setting Up a Custom Domain

1. In Cloudflare Pages, go to your project
2. Navigate to **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `juketogether.com`)
5. Follow the DNS configuration instructions

### DNS Configuration

Add a CNAME record pointing to your Cloudflare Pages domain:
- **Type**: CNAME
- **Name**: `@` or `www` (depending on your preference)
- **Target**: `juketogether.pages.dev`

## Build Troubleshooting

### Common Issues

#### Build Fails with "Command not found"
- Ensure Node.js version is set correctly in environment variables
- Check that `npm install` runs before the build command

#### Routes Return 404
- Verify that `_redirects` file exists in `web-build` directory
- Check that the file contains the SPA redirect rule

#### Build Output Not Found
- Ensure build output directory is set to `web-build`
- Verify the build command completes successfully

### Build Logs

Check build logs in Cloudflare Pages:
1. Go to your project → **Deployments**
2. Click on a deployment to view logs
3. Look for errors in the build output

## Environment Variables

If your app requires environment variables at build time:

1. Go to **Settings** → **Environment variables**
2. Add variables for:
   - **Production**: Variables for production builds
   - **Preview**: Variables for preview deployments

Example variables you might need:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL`

## Performance Optimization

### Caching

Cloudflare Pages automatically caches static assets. The `_redirects` file ensures proper SPA routing while maintaining cache benefits.

### Build Optimization

- The Expo web build is optimized for production
- Static assets are automatically compressed by Cloudflare
- CDN distribution is handled automatically

## Monitoring

### Analytics

Cloudflare Pages provides built-in analytics:
- Page views
- Bandwidth usage
- Build times
- Deployment history

### Error Tracking

Consider integrating error tracking (e.g., Sentry) for runtime errors in production.

## Comparison with Vercel

This project also supports Vercel deployment (see `vercel.json`). Key differences:

- **Cloudflare Pages**: Better for static sites, global CDN, free tier includes more bandwidth
- **Vercel**: Better for serverless functions, more framework presets, better Next.js support

For an Expo web app, both platforms work well. Choose based on your needs.

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Expo Web Deployment](https://docs.expo.dev/workflow/web/)
- [Cloudflare Pages Build Configuration](https://developers.cloudflare.com/pages/platform/build-configuration/)

