const express = require('express');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Proxy middleware that adds bypass header
const proxyMiddleware = createProxyMiddleware({
  target: 'http://localhost:8080',
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for Socket.io
  onProxyReq: (proxyReq, req, res) => {
    // Add bypass header to skip localtunnel password page
    proxyReq.setHeader('bypass-tunnel-reminder', 'true');
    // Also set custom user agent to bypass
    proxyReq.setHeader('User-Agent', 'SoundCloud-Jukebox-Proxy/1.0');
  },
  onProxyRes: (proxyRes, req, res) => {
    // Remove any password-related redirects
    if (proxyRes.statusCode === 401) {
      // If we get 401, try to forward anyway
      return;
    }
  }
});

// Proxy all requests
app.use('/', proxyMiddleware);

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  proxyMiddleware.upgrade(req, socket, head);
});

const PORT = process.env.PROXY_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`This proxy adds bypass headers to skip localtunnel password page`);
  console.log(`Point your localtunnel to this port instead: npx localtunnel --port ${PORT}`);
  console.log(`WebSocket support enabled for Socket.io`);
});

