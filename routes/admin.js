const express = require('express');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const Settings = require('../models/Settings');
const Order = require('../models/Order');
const Plan = require('../models/Plan');
const cloudinaryService = require('../services/cloudinaryService');
const emailService = require('../services/emailService');

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

// Get dashboard stats with date filtering
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const { range = 'all' } = req.query;

    // Calculate date range
    let dateFilter = {};
    const now = new Date();

    if (range !== 'all') {
      let startDate;
      switch (range) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          dateFilter = { createdAt: { $gte: startDate, $lte: endOfLastMonth } };
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'lastYear':
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
          dateFilter = { createdAt: { $gte: startDate, $lte: endOfLastYear } };
          break;
        default:
          startDate = null;
      }

      if (startDate && !dateFilter.createdAt) {
        dateFilter = { createdAt: { $gte: startDate } };
      }
    }

    const totalOrders = await Order.countDocuments(dateFilter);
    const pendingOrders = await Order.countDocuments({ ...dateFilter, status: 'pending' });
    const approvedOrders = await Order.countDocuments({ ...dateFilter, status: 'approved' });
    const rejectedOrders = await Order.countDocuments({ ...dateFilter, status: 'rejected' });
    const completedOrders = await Order.countDocuments({ ...dateFilter, status: 'completed' });

    // Calculate revenue from approved and completed orders
    const revenueResult = await Order.aggregate([
      { $match: { ...dateFilter, status: { $in: ['approved', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const recentOrders = await Order.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get stats breakdown by item type
    const rankOrders = await Order.countDocuments({ ...dateFilter, itemType: 'rank' });
    const planOrders = await Order.countDocuments({ ...dateFilter, itemType: 'plan' });

    res.json({
      totalOrders,
      pendingOrders,
      approvedOrders,
      rejectedOrders,
      completedOrders,
      totalRevenue,
      recentOrders,
      rankOrders,
      planOrders,
      dateRange: range
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
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

// Test email connection
router.post('/test-email-connection', authMiddleware, async (req, res) => {
  try {
    console.log('Testing email connection...');
    const result = await emailService.verifyConnection();
    if (result.success) {
      res.json({ success: true, message: 'Email connection verified successfully!' });
    } else {
      res.status(400).json({ success: false, error: result.error, originalError: result.originalError });
    }
  } catch (error) {
    console.error('Email connection test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send test email
router.post('/send-test-email', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    console.log('Sending test email to:', email);
    const result = await emailService.sendTestEmail(email);

    if (result.success) {
      res.json({ success: true, message: `Test email sent to ${email}`, messageId: result.messageId });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get public settings (PUBLIC - no auth required for homepage)
router.get('/public-settings', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      whatsappNumber: settings.whatsappNumber || '+917041508202',
      contactNumber: settings.contactNumber || '+917041508202',
      telegramLink: settings.telegramLink || 'https://t.me/dream11tips',
      upiId: settings.upiId || '',
      upiName: settings.upiName || ''
    });
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

// Get rank promo image (PUBLIC - no auth required for homepage)
router.get('/rank-promo-image', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      rankPromoImage: settings.rankPromoImage || ''
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update rank promo image (admin only)
router.put('/rank-promo-image', authMiddleware, async (req, res) => {
  try {
    let settings = await Settings.findOne();

    // Track old image for cleanup
    const oldImageUrl = settings?.rankPromoImage || null;
    const oldPublicId = settings?.rankPromoImagePublicId || null;
    const imageChanged = req.body.rankPromoImage &&
                         req.body.rankPromoImage !== oldImageUrl &&
                         oldImageUrl;

    if (!settings) {
      settings = new Settings({
        rankPromoImage: req.body.rankPromoImage,
        rankPromoImagePublicId: req.body.rankPromoImagePublicId || ''
      });
    } else {
      settings.rankPromoImage = req.body.rankPromoImage;
      settings.rankPromoImagePublicId = req.body.rankPromoImagePublicId || '';
    }

    await settings.save();

    // Cleanup old image
    if (imageChanged) {
      cloudinaryService.deleteImage(oldPublicId, oldImageUrl).catch(err => {
        console.error('Failed to delete old rank promo image:', err);
      });
    }

    res.json({
      message: 'Rank promo image updated',
      rankPromoImage: settings.rankPromoImage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get timer settings (PUBLIC - no auth required for homepage)
router.get('/timer', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      timerDeadline: settings.timerDeadline || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get timer settings for admin dashboard (admin only)
router.get('/timer-settings', authMiddleware, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      timerDeadline: settings.timerDeadline
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update timer settings (admin only)
router.put('/timer-settings', authMiddleware, async (req, res) => {
  try {
    const { timerDeadline } = req.body;

    if (!timerDeadline) {
      return res.status(400).json({ message: 'Timer deadline is required' });
    }

    const deadline = new Date(timerDeadline);
    if (isNaN(deadline.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Check if deadline is in the future
    if (deadline <= new Date()) {
      return res.status(400).json({ message: 'Timer deadline must be in the future' });
    }

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ timerDeadline: deadline });
    } else {
      settings.timerDeadline = deadline;
    }

    await settings.save();
    res.json({
      message: 'Timer deadline updated successfully',
      timerDeadline: settings.timerDeadline
    });
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
