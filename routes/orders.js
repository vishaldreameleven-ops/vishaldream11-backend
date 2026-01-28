const express = require('express');
const authMiddleware = require('../middleware/auth');
const Order = require('../models/Order');
const Plan = require('../models/Plan');

const router = express.Router();

// Create order (public - user submits payment)
router.post('/', async (req, res) => {
  try {
    const { planId, name, phone, email, utrNumber } = req.body;

    // Validate required fields
    if (!planId || !name || !phone || !utrNumber) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const order = new Order({
      planId: plan._id,
      planName: plan.name,
      amount: plan.price,
      name,
      phone,
      email: email || '',
      utrNumber,
      status: 'pending'
    });

    await order.save();

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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all orders (admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Transform for frontend
    const transformedOrders = orders.map(order => ({
      id: order._id.toString(),
      orderId: order.orderId,
      planId: order.planId.toString(),
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
      planId: order.planId.toString(),
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

    const updateData = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
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
