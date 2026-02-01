const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const adminRoutes = require('./routes/admin');
const plansRoutes = require('./routes/plans');
const ranksRoutes = require('./routes/ranks');
const ordersRoutes = require('./routes/orders');
const contentRoutes = require('./routes/content');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

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
// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin login: POST /api/admin/login`);
  console.log(`Plans: GET /api/plans`);
  console.log(`Orders: POST /api/orders`);
});
