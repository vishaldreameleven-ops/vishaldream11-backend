const express = require('express');
const authMiddleware = require('../middleware/auth');
const Order = require('../models/Order');
const Plan = require('../models/Plan');
const Settings = require('../models/Settings');
const emailService = require('../services/emailService');
const pdfService = require('../services/pdfService');

const router = express.Router();

// Create order (public - user submits payment)
router.post('/', async (req, res) => {
  try {
    console.log('=== ORDER REQUEST ===');
    console.log('Raw body:', JSON.stringify(req.body));

    const { planId, rankId, itemType, planName, amount, name, phone, email, utrNumber } = req.body;

    console.log('Parsed fields:', { planId, rankId, itemType, planName, amount, name, phone, utrNumber });

    // Validate required fields with specific error messages
    if (!planId && !rankId) {
      console.log('VALIDATION FAILED: No planId or rankId');
      return res.status(400).json({ message: 'Order type (plan or rank) is required' });
    }
    if (!name || !name.trim()) {
      console.log('VALIDATION FAILED: No name');
      return res.status(400).json({ message: 'Please enter your full name' });
    }
    if (!phone || !phone.trim()) {
      console.log('VALIDATION FAILED: No phone');
      return res.status(400).json({ message: 'Please enter your WhatsApp number' });
    }
    if (!utrNumber || !utrNumber.trim()) {
      console.log('VALIDATION FAILED: No utrNumber');
      return res.status(400).json({ message: 'Please enter UTR/Transaction ID' });
    }

    // Validate based on item type
    if (itemType === 'rank') {
      // For ranks, only amount is required (planName will be fetched from DB)
      if (!amount) {
        console.log('VALIDATION FAILED: No amount for rank', { amount });
        return res.status(400).json({ message: 'Invalid item details. Please refresh and try again.' });
      }
    } else {
      // For plans, both planName and amount are required
      if (!planName || !amount) {
        console.log('VALIDATION FAILED: No planName or amount', { planName, amount });
        return res.status(400).json({ message: 'Invalid item details. Please refresh and try again.' });
      }
    }

    console.log('All validations passed!');

    // Check if UTR already exists (case-insensitive)
    const existingOrder = await Order.findOne({ utrNumber: utrNumber.trim().toUpperCase() });
    if (existingOrder) {
      console.log('DUPLICATE UTR DETECTED:', utrNumber.trim().toUpperCase());
      return res.status(409).json({ message: 'This UTR number has already been used. Please check your payment details.' });
    }

    // Validate phone number
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    // Validate UTR length
    if (utrNumber.trim().length < 10) {
      return res.status(400).json({ message: 'Please enter a valid UTR/Transaction ID' });
    }

    // Try to get the plan or rank, but don't fail if not found (use sent data)
    let finalPlanName = planName;
    let finalAmount = amount;
    let finalPlanId = planId || null;
    let finalRankId = rankId || null;
    let finalItemType = itemType || 'plan';

    // Handle Rank orders
    if (itemType === 'rank' && rankId) {
      try {
        const Rank = require('../models/Rank');
        const rank = await Rank.findById(rankId);
        if (rank) {
          finalRankId = rank._id;
          finalPlanName = rank.name;
          finalAmount = rank.discountedPrice;
        }
      } catch (rankError) {
        console.log('Rank lookup skipped:', rankError.message);
      }
    }
    // Handle Plan orders
    else if (planId) {
      try {
        const plan = await Plan.findById(planId);
        if (plan) {
          finalPlanId = plan._id;
          // Use sent planName and amount (they include discount calculation from frontend)
        }
      } catch (planError) {
        console.log('Plan lookup skipped:', planError.message);
      }
    }

    const order = new Order({
      planId: finalPlanId,
      rankId: finalRankId,
      itemType: finalItemType,
      planName: finalPlanName,
      amount: finalAmount,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      utrNumber: utrNumber.trim().toUpperCase(),
      paymentMethod: 'upi_manual',
      status: 'pending'
    });

    await order.save();

    // Emit socket event for new order (real-time admin notification)
    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('new-order', {
        id: order._id.toString(),
        orderId: order.orderId,
        planName: order.planName,
        amount: order.amount,
        name: order.name,
        phone: order.phone,
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt
      });
      console.log('Socket event emitted: new-order', order.orderId);
    }

    // Send order confirmation email (non-blocking)
    try {
      const settings = await Settings.getSettings();
      emailService.sendOrderPlacedEmail(order, settings).catch(err => {
        console.log('Order placed email failed:', err.message);
      });
    } catch (emailErr) {
      console.log('Email service error:', emailErr.message);
    }

    res.status(201).json({
      message: 'Order submitted successfully! We will verify your payment shortly.',
      order: {
        orderId: order.orderId,
        planName: order.planName,
        amount: order.amount,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Order creation error:', error);

    // Handle duplicate key error (if UTR check somehow fails)
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This payment has already been submitted' });
    }

    res.status(500).json({ message: 'Unable to submit order. Please try again.', error: error.message });
  }
});

// Get all orders (admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    } else {
      // Exclude awaiting_payment orders by default (Cashfree orders where user hasn't paid yet)
      query.status = { $ne: 'awaiting_payment' };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Transform for frontend
    const transformedOrders = orders.map(order => ({
      id: order._id.toString(),
      orderId: order.orderId,
      planId: order.planId ? order.planId.toString() : null,
      rankId: order.rankId ? order.rankId.toString() : null,
      itemType: order.itemType || 'plan',
      planName: order.planName,
      amount: order.amount,
      name: order.name,
      phone: order.phone,
      email: order.email,
      utrNumber: order.utrNumber,
      paymentMethod: order.paymentMethod || 'upi_manual',
      cashfreePaymentId: order.cashfreePaymentId || null,
      cashfreePaymentMode: order.cashfreePaymentMode || null,
      status: order.status,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    res.json(transformedOrders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single order (admin)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    // Try to find by _id or orderId
    let order = await Order.findById(req.params.id).lean();

    if (!order) {
      order = await Order.findOne({ orderId: req.params.id }).lean();
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      id: order._id.toString(),
      orderId: order.orderId,
      planId: order.planId ? order.planId.toString() : null,
      rankId: order.rankId ? order.rankId.toString() : null,
      itemType: order.itemType || 'plan',
      planName: order.planName,
      amount: order.amount,
      name: order.name,
      phone: order.phone,
      email: order.email,
      utrNumber: order.utrNumber,
      status: order.status,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update order status (admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;

    // Get the current order to check if status is changing to approved
    const currentOrder = await Order.findById(req.params.id);
    if (!currentOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const wasNotApproved = currentOrder.status !== 'approved';
    const willBeApproved = status === 'approved';

    const updateData = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Send approval email with PDF if status changed to approved
    if (wasNotApproved && willBeApproved && order.email) {
      try {
        const settings = await Settings.getSettings();
        const pdfBuffer = await pdfService.generateGuaranteeCertificate(order, settings);
        emailService.sendOrderApprovedEmail(order, pdfBuffer, settings).catch(err => {
          console.log('Approval email failed:', err.message);
        });
      } catch (emailErr) {
        console.log('Email/PDF service error:', emailErr.message);
      }
    }

    res.json({
      message: 'Order updated',
      order: {
        id: order._id.toString(),
        orderId: order.orderId,
        status: order.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete order (admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ message: 'Order deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Check order status (public - by order ID and phone)
router.post('/check', async (req, res) => {
  try {
    const { orderId, phone } = req.body;

    const order = await Order.findOne({ orderId, phone }).lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      orderId: order.orderId,
      planName: order.planName,
      amount: order.amount,
      status: order.status,
      createdAt: order.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
