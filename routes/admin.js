const express = require('express');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const Settings = require('../models/Settings');
const Order = require('../models/Order');
const Plan = require('../models/Plan');

const router = express.Router();

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { adminId, password } = req.body;

    // Check credentials against env variables
    if (adminId !== process.env.ADMIN_ID || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { adminId, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: { id: adminId }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify token
router.get('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, admin: req.admin });
});

// Get dashboard stats
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const approvedOrders = await Order.countDocuments({ status: 'approved' });
    const rejectedOrders = await Order.countDocuments({ status: 'rejected' });

    const revenueResult = await Order.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      totalOrders,
      pendingOrders,
      approvedOrders,
      rejectedOrders,
      totalRevenue,
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update settings
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json({ message: 'Settings updated', settings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get featured match (PUBLIC - no auth required for homepage)
router.get('/featured-match', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings.featuredMatch || {
      team1Name: 'Mumbai',
      team1Short: 'MI',
      team1Color: '#004BA0',
      team2Name: 'Chennai',
      team2Short: 'CSK',
      team2Color: '#F9CD05',
      matchTime: 'Today 7:30 PM',
      venue: 'Wankhede Stadium',
      tournament: 'IPL 2026',
      isLive: false
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update featured match (admin only)
router.put('/featured-match', authMiddleware, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ featuredMatch: req.body });
    } else {
      settings.featuredMatch = req.body;
    }
    await settings.save();
    res.json({ message: 'Featured match updated', featuredMatch: settings.featuredMatch });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Initialize default data (run once)
router.post('/init', authMiddleware, async (req, res) => {
  try {
    // Check if plans exist
    const planCount = await Plan.countDocuments();
    if (planCount === 0) {
      await Plan.insertMany([
        {
          name: 'Grand League',
          price: 499,
          period: '/match',
          description: 'Expert GL tips',
          features: ['Captain Picks', 'Detailed Analysis', '24/7 Support'],
          popular: false,
          active: true
        },
        {
          name: 'Premium',
          price: 2999,
          period: '/month',
          description: 'All matches covered',
          features: ['All Matches', 'GL + SL Teams', 'WhatsApp Group', 'Priority Support'],
          popular: true,
          active: true
        },
        {
          name: 'Small League',
          price: 299,
          period: '/match',
          description: 'Safe SL teams',
          features: ['Multiple Teams', 'Safe Picks', 'Live Updates'],
          popular: false,
          active: true
        }
      ]);
    }

    // Initialize settings
    await Settings.getSettings();

    res.json({ message: 'Initialization complete' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
