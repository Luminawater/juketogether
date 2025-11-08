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
- **Build command**: 
  ```bash
  npm install && npm run build:cloudflare
  ```
  Or if you prefer the direct command:
  ```bash
  cd SoundCloudJukeboxMobile && npm install && npx --yes expo export -p web --output-dir ../web-build
  ```

- **Build output directory**: `web-build`
- **Root directory**: `/` (leave empty or set to root)

#### Environment Variables

Add the following environment variables in Cloudflare Pages:

- `NODE_VERSION`: `18` or `20` (recommended)
- Any Expo-specific environment variables if needed

### 3. Build Script

The project includes a `build:cloudflare` script that:
1. Builds the Expo web app
2. Copies the `_redirects` file for SPA routing support

```json
"build:cloudflare": "npm run build:web && node scripts/copy-redirects.js"
```

### 4. SPA Routing

The `_redirects` file in the `web-build` directory ensures that all routes serve `index.html` for client-side routing:

```
/*    /index.html   200
```

This is automatically created during the build process.

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

