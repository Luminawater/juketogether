const fs = require('fs');
const path = require('path');

// Copy _redirects and _headers files to web-build directory for Cloudflare Pages
const redirectsSource = path.join(__dirname, '..', '_redirects.template');
const redirectsDest = path.join(__dirname, '..', 'web-build', '_redirects');

const headersSource = path.join(__dirname, '..', '_headers.template');
const headersDest = path.join(__dirname, '..', 'web-build', '_headers');

// Ensure web-build directory exists
const webBuildDir = path.join(__dirname, '..', 'web-build');
if (!fs.existsSync(webBuildDir)) {
  console.error('Error: web-build directory does not exist. Run build:web first.');
  process.exit(1);
}

// Copy _redirects file from template
if (fs.existsSync(redirectsSource)) {
  fs.copyFileSync(redirectsSource, redirectsDest);
  console.log('✓ _redirects file copied to web-build directory');
} else {
  // Fallback: create _redirects file directly
  const redirectsContent = `# Cloudflare Pages SPA redirects
# All routes should serve index.html for client-side routing
/*    /index.html   200
`;
  fs.writeFileSync(redirectsDest, redirectsContent, 'utf8');
  console.log('✓ _redirects file created in web-build directory');
}

// Copy _headers file from template
if (fs.existsSync(headersSource)) {
  fs.copyFileSync(headersSource, headersDest);
  console.log('✓ _headers file copied to web-build directory');
} else {
  console.log('⚠ _headers.template not found, skipping headers file');
}

