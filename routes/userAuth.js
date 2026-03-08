const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const userAuthMiddleware = require('../middleware/userAuth');

const router = express.Router();

// POST /api/user-auth/register
router.post('/register', async (req, res) => {
  try {
    const { phone, name, password } = req.body;

    if (!phone || !name || !password) {
      return res.status(400).json({ message: 'Phone, name, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ message: 'An account with this phone number already exists' });
    }

    const user = await User.create({ phone, name, password });

    const token = jwt.sign(
      { userId: user._id, phone: user.phone, name: user.name, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors)[0].message;
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Registration failed' });
  }
});

// POST /api/user-auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: 'Invalid phone number or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid phone number or password' });
    }

    const token = jwt.sign(
      { userId: user._id, phone: user.phone, name: user.name, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// GET /api/user-auth/me  (requires user JWT)
router.get('/me', userAuthMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for paid order (approved or completed) matched by phone
    const paidOrder = await Order.findOne({
      phone: user.phone,
      status: { $in: ['approved', 'completed'] },
    }).sort({ createdAt: -1 });

    res.json({
      user: { id: user._id, name: user.name, phone: user.phone },
      hasPaidOrder: !!paidOrder,
      orderDetails: paidOrder
        ? {
            orderId: paidOrder.orderId,
            planName: paidOrder.planName,
            amount: paidOrder.amount,
            status: paidOrder.status,
          }
        : null,
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ message: 'Failed to fetch user info' });
  }
});

module.exports = router;
