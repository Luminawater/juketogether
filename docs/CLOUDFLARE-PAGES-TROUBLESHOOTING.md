# Cloudflare Pages Troubleshooting

## Internal Error During Build

If you see "Failed: an internal error occurred", try these solutions:

### Solution 1: Use Direct Build Command

Instead of using `npm run build:cloudflare`, use the direct command in Cloudflare Pages:

**Build command:**
```bash
cd SoundCloudJukeboxMobile && npm install && npx --yes expo export -p web --output-dir ../web-build && cd .. && echo "/*    /index.html   200" > web-build/_redirects
```

This avoids potential issues with npm script chaining.

### Solution 2: Split the Build Process

If the build times out, try building in stages:

1. **First, set build command to just install:**
   ```bash
   npm install && cd SoundCloudJukeboxMobile && npm install
   ```

2. **Then set build command to:**
   ```bash
   cd SoundCloudJukeboxMobile && npx --yes expo export -p web --output-dir ../web-build
   ```

3. **Add a post-build script** or manually add the redirects file to the repository

### Solution 3: Pre-build the Site Locally

1. Build locally:
   ```bash
   npm run build:cloudflare
   ```

2. Commit the `web-build` directory to git (temporarily)

3. Set Cloudflare Pages build command to:
   ```bash
   echo "Build already done, using committed files"
   ```

4. Set build output directory to: `web-build`

**Note:** This requires committing build artifacts, which is not ideal but can work as a workaround.

### Solution 4: Check Build Logs

1. Go to Cloudflare Pages Dashboard
2. Click on the failed deployment
3. Check the build logs for specific errors
4. Look for:
   - Memory errors
   - Timeout errors
   - Missing dependencies
   - Node version issues

### Solution 5: Optimize Build

Add to Cloudflare Pages environment variables:
- `NODE_OPTIONS=--max-old-space-size=4096` (increases memory)
- `NODE_VERSION=20` (use Node 20 for better performance)

### Solution 6: Simplify Build Command

Try the minimal build command:
```bash
cd SoundCloudJukeboxMobile && npm ci && npx expo export -p web --output-dir ../web-build && echo "/*    /index.html   200" > ../web-build/_redirects
```

### Solution 7: Contact Cloudflare Support

If none of the above work, the issue might be on Cloudflare's side:
- Go to: https://cfl.re/3WgEyrH
- Provide your project name and deployment ID
- Include the build logs

## Common Issues

### Build Timeout
- Expo builds can take 5-10 minutes
- Cloudflare Pages free tier has build time limits
- Consider upgrading or using a different build approach

### Memory Issues
- Large dependencies (React Native, Expo) can use a lot of memory
- Try setting `NODE_OPTIONS=--max-old-space-size=4096`

### Missing Dependencies
- Ensure all dependencies are in `package.json`
- Check that `SoundCloudJukeboxMobile/package.json` has all required packages

### Node Version
- Set `NODE_VERSION=20` in environment variables
- Expo SDK 54 requires Node 18+

## Alternative: Use GitHub Actions

If Cloudflare Pages continues to have issues, you can:

1. Use GitHub Actions to build the site
2. Push the built files to a separate branch
3. Point Cloudflare Pages to that branch

This gives you more control over the build environment.

