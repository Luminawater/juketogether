# Cloudflare Pages Quick Reference

Quick reference for configuring JukeTogether on Cloudflare Pages dashboard.

## Dashboard Settings

When setting up the project in Cloudflare Pages, use these exact settings:

### Project Settings

- **Project name**: `juketogether`
- **Production branch**: `main`
- **Root directory**: `/` (leave empty or set to root)

### Build Settings

- **Framework preset**: `None` or `Create React App`
  - ⚠️ **Note**: This is an Expo app, not Next.js. Do not use the Next.js preset.

- **Build command** (recommended):
  ```
  cd SoundCloudJukeboxMobile && npm install && npx --yes expo export -p web --output-dir ../web-build && cd .. && echo "/*    /index.html   200" > web-build/_redirects
  ```

  Or alternative:
  ```
  npm run build:cloudflare:direct
  ```

- **Build output directory**: `web-build`

### Environment Variables (Optional)

Add these if needed for build-time configuration:

- `NODE_VERSION`: `18` or `20`

## Important Notes

1. **This is NOT a Next.js project** - It's an Expo (React Native Web) app
2. The build output goes to `web-build` directory
3. The `_redirects` file is automatically created during build for SPA routing
4. Your site will be available at `juketogether.pages.dev` after deployment

## Build Command Breakdown

Build commands:
1. Direct command: Builds Expo web app and creates `_redirects` inline
2. `build:cloudflare:direct`: Same as direct command but using npm script

## After Setup

1. Push to `main` branch to trigger automatic deployment
2. Check deployment status in Cloudflare Pages dashboard
3. Visit `juketogether.pages.dev` to see your deployed app

## Troubleshooting

If build fails:
- Check that Node.js version is set (18 or 20)
- Verify build command is correct
- Check build logs in Cloudflare Pages dashboard

If routes return 404:
- Verify `_redirects` file exists in `web-build/` after build
- Check that build output directory is set to `web-build`

