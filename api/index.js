// Vercel serverless function handler
// Import the Express app (without starting the server)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Use node-fetch for older Node versions, or built-in fetch for Node 18+
let fetch;
try {
  if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
  } else {
    fetch = require('node-fetch');
  }
} catch (e) {
  console.warn('Fetch not available. Install node-fetch: npm install node-fetch@2');
  fetch = null;
}

const app = express();
const server = http.createServer(app);

// Only initialize Socket.io if not in serverless environment
// Vercel serverless functions don't support persistent WebSocket connections
// For Socket.io, you may need a separate service or Vercel's WebSocket support
let io = null;
if (process.env.VERCEL) {
  console.log('Running in Vercel - Socket.io will be limited');
} else {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
}

app.use(cors());
app.use(express.json());
// Static files are now served by Vercel from web-build directory
// app.use(express.static(path.join(__dirname, '..', 'public')));

// Import and set up routes (simplified for Vercel)
// For full functionality, you'll need to include all your routes here
// or import them from server.js

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', vercel: true });
});

// Root route is now handled by Vercel static build (Expo web app)
// app.get('/', ...) removed - Vercel serves index.html from web-build

// For Vercel, export the app (not the server)
// The server.listen() is handled by Vercel
module.exports = app;
