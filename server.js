const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const adminRoutes = require('./routes/admin');
const plansRoutes = require('./routes/plans');
const ranksRoutes = require('./routes/ranks');
const ordersRoutes = require('./routes/orders');
const contentRoutes = require('./routes/content');
const uploadRoutes = require('./routes/upload');
const cashfreeRoutes = require('./routes/cashfree');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://1strankcome.com',
      'https://www.1strankcome.com',
      'https://vishaldream11.vercel.app',
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Admin client connected:', socket.id);

  // Join admin room for order notifications
  socket.on('join-admin', () => {
    socket.join('admin-room');
    console.log('Client joined admin-room:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Connect to MongoDB
connectDB();

// CORS configuration - allow your frontend domains
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://1strankcome.com',
    'https://www.1strankcome.com',
    'https://vishaldream11.vercel.app',
    // Allow all origins as fallback (for testing)
    /\.vercel\.app$/,
    /\.onrender\.com$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({
  verify: (req, res, buf) => {
    // Store raw body for Cashfree webhook signature verification
    if (req.originalUrl === '/api/cashfree/webhook') {
      req.rawBody = buf.toString();
    }
  }
}));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/ranks', ranksRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/cashfree', cashfreeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io enabled for real-time updates`);
  console.log(`Admin login: POST /api/admin/login`);
  console.log(`Plans: GET /api/plans`);
  console.log(`Orders: POST /api/orders`);
});
