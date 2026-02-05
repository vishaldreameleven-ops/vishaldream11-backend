const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Settings = require('../models/Settings');
const cashfreeService = require('../services/cashfreeService');
const emailService = require('../services/emailService');
const pdfService = require('../services/pdfService');

// Helper: Send approval email with PDF (used by both webhook and verify)
async function sendApprovalEmail(order) {
  if (!order.email) return;
  try {
    const settings = await Settings.getSettings();
    const pdfBuffer = await pdfService.generateGuaranteeCertificate(order, settings);
    await emailService.sendOrderApprovedEmail(order, pdfBuffer, settings);
    console.log(`Approval email sent for order ${order.orderId}`);
  } catch (err) {
    console.error(`Approval email/PDF failed for ${order.orderId}:`, err.message);
  }
}

// Helper: Approve order atomically (prevents race condition between webhook and verify)
async function approveOrder(orderId, paymentId, paymentStatus, paymentMode, paymentAmount, io = null) {
  // Use findOneAndUpdate with condition to prevent double-approval
  const updatedOrder = await Order.findOneAndUpdate(
    { orderId: orderId, status: { $ne: 'approved' } },
    {
      $set: {
        cashfreePaymentId: String(paymentId),
        cashfreePaymentStatus: paymentStatus,
        cashfreePaymentMode: paymentMode,
        status: 'approved'
      }
    },
    { new: true }
  );

  if (!updatedOrder) {
    // Already approved (by webhook or verify) — skip email
    console.log(`Order ${orderId} already approved, skipping duplicate`);
    return null;
  }

  console.log(`Order ${orderId} approved (amount: ₹${paymentAmount})`);

  // Emit socket event for approved order (real-time admin notification)
  if (io) {
    io.to('admin-room').emit('new-order', {
      id: updatedOrder._id.toString(),
      orderId: updatedOrder.orderId,
      planName: updatedOrder.planName,
      amount: updatedOrder.amount,
      name: updatedOrder.name,
      phone: updatedOrder.phone,
      status: updatedOrder.status,
      paymentMethod: updatedOrder.paymentMethod,
      createdAt: updatedOrder.createdAt
    });
    console.log('Socket event emitted: new-order (cashfree approved)', updatedOrder.orderId);
  }

  // Send email in background (non-blocking)
  sendApprovalEmail(updatedOrder);

  return updatedOrder;
}

// POST /api/cashfree/create-order - Create order and get Cashfree payment session
router.post('/create-order', async (req, res) => {
  try {
    const { planId, rankId, itemType, planName, rankNumber, amount, name, phone, email } = req.body;

    // Validations
    if (!planId && !rankId) {
      return res.status(400).json({ message: 'Order type (plan or rank) is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Please enter your full name' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Please enter your WhatsApp number' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required for online payment' });
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    // Resolve plan/rank details from DB (server-side price — prevents tampering)
    let finalPlanName = planName;
    let finalAmount = amount;
    let finalPlanId = planId || null;
    let finalRankId = rankId || null;
    let finalItemType = itemType || 'plan';

    if (itemType === 'rank' && rankId) {
      try {
        const Rank = require('../models/Rank');
        const rank = await Rank.findById(rankId);
        if (rank) {
          finalRankId = rank._id;
          finalPlanName = rank.name || finalPlanName;
          finalAmount = rank.discountedPrice; // Server-side price
        } else {
          return res.status(404).json({ message: 'Rank not found' });
        }
      } catch (e) {
        console.log('Rank lookup error:', e.message);
        return res.status(400).json({ message: 'Invalid rank selected' });
      }
    } else if (planId) {
      try {
        const Plan = require('../models/Plan');
        const plan = await Plan.findById(planId);
        if (plan) {
          finalPlanId = plan._id;
          finalPlanName = plan.name || finalPlanName;
          // Calculate server-side price with discount
          finalAmount = plan.discount ? Math.round(plan.price * (1 - plan.discount / 100)) : plan.price;
        } else {
          return res.status(404).json({ message: 'Plan not found' });
        }
      } catch (e) {
        console.log('Plan lookup error:', e.message);
        return res.status(400).json({ message: 'Invalid plan selected' });
      }
    }

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Create Cashfree order FIRST (if this fails, no DB record is created)
    const frontendUrl = process.env.FRONTEND_URL || 'https://1strankcome.com';
    const returnUrl = `${frontendUrl}/payment/status`;

    // Generate orderId before saving
    const orderId = 'ORD' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();

    const cashfreeOrder = await cashfreeService.createOrder({
      orderId: orderId,
      amount: finalAmount,
      customerName: name.trim(),
      customerEmail: email.trim(),
      customerPhone: phone.trim(),
      returnUrl,
    });

    if (!cashfreeOrder || !cashfreeOrder.payment_session_id) {
      return res.status(500).json({ message: 'Payment gateway error. Please try again.' });
    }

    // Now save internal order (Cashfree order exists, safe to save)
    const order = new Order({
      orderId: orderId,
      planId: finalPlanId,
      rankId: finalRankId,
      itemType: finalItemType,
      planName: finalPlanName,
      amount: finalAmount,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      utrNumber: null,
      paymentMethod: 'cashfree',
      cashfreeOrderId: String(cashfreeOrder.cf_order_id),
      status: 'awaiting_payment'
    });

    await order.save();

    res.status(201).json({
      success: true,
      orderId: order.orderId,
      paymentSessionId: cashfreeOrder.payment_session_id,
    });
  } catch (error) {
    console.error('Cashfree order creation error:', error.message);
    res.status(500).json({ message: 'Failed to create payment. Please try again.' });
  }
});

// POST /api/cashfree/webhook - Cashfree payment webhook
router.post('/webhook', async (req, res) => {
  try {
    const timestamp = req.headers['x-webhook-timestamp'];
    const signature = req.headers['x-webhook-signature'];
    const rawBody = req.rawBody;

    // Signature verification is MANDATORY in production
    if (process.env.CASHFREE_ENV === 'production') {
      if (!process.env.CASHFREE_WEBHOOK_SECRET) {
        console.error('CRITICAL: CASHFREE_WEBHOOK_SECRET not configured in production');
        return res.status(500).json({ message: 'Webhook not configured' });
      }
      if (!rawBody || !signature || !timestamp) {
        console.error('Webhook missing signature headers');
        return res.status(401).json({ message: 'Missing signature' });
      }
      if (!cashfreeService.verifyWebhookSignature(timestamp, rawBody, signature)) {
        console.error('Webhook signature verification FAILED');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    } else if (process.env.CASHFREE_WEBHOOK_SECRET && rawBody && signature) {
      // In sandbox, verify if credentials are available
      if (!cashfreeService.verifyWebhookSignature(timestamp, rawBody, signature)) {
        console.error('Webhook signature verification failed (sandbox)');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const event = req.body;
    console.log('Cashfree webhook event:', event?.type);

    // Validate webhook payload structure
    if (!event || !event.data || !event.data.order || !event.data.payment) {
      console.error('Malformed webhook payload:', JSON.stringify(event).slice(0, 200));
      return res.status(400).json({ message: 'Invalid payload' });
    }

    if (event.type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const paymentData = event.data;
      const orderId = paymentData.order.order_id;
      const paymentId = paymentData.payment.cf_payment_id;
      const paymentStatus = paymentData.payment.payment_status;
      const paymentMode = paymentData.payment.payment_group;
      const paymentAmount = paymentData.payment.payment_amount;

      // Find the order
      const order = await Order.findOne({ orderId: orderId });
      if (!order) {
        console.error('Webhook: Order not found:', orderId);
        return res.status(404).json({ message: 'Order not found' });
      }

      // CRITICAL: Verify payment amount matches order amount
      if (paymentAmount !== undefined && Math.abs(paymentAmount - order.amount) > 0.01) {
        console.error(`AMOUNT MISMATCH: Order ${orderId} expects ₹${order.amount}, got ₹${paymentAmount}`);
        return res.status(400).json({ message: 'Amount mismatch' });
      }

      // Approve order atomically (prevents race condition & duplicate emails)
      const io = req.app.get('io');
      await approveOrder(orderId, paymentId, paymentStatus, paymentMode, paymentAmount, io);
    }

    res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    // Return 500 so Cashfree retries the webhook
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// POST /api/cashfree/create-link - Create a shareable payment link
router.post('/create-link', async (req, res) => {
  try {
    const { amount, purpose, customerName, customerEmail, customerPhone, expiryDays } = req.body;

    // Validations
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ message: 'Customer phone is required' });
    }
    if (!customerEmail || !customerEmail.trim()) {
      return res.status(400).json({ message: 'Customer email is required' });
    }
    if (!/^[6-9]\d{9}$/.test(customerPhone.trim())) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${frontendUrl}/payment/link-status`;

    // Generate unique link ID
    const linkId = 'LINK' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();

    // Calculate expiry time (default 7 days)
    let expiryTime = null;
    if (expiryDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
      expiryTime = expiryDate.toISOString();
    }

    const paymentLink = await cashfreeService.createPaymentLink({
      linkId,
      amount: parseFloat(amount),
      purpose: purpose || 'Premium Rank Payment',
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      returnUrl,
      expiryTime,
    });

    if (!paymentLink || !paymentLink.link_url) {
      return res.status(500).json({ message: 'Failed to create payment link' });
    }

    // Create order record for this payment link
    const order = new Order({
      orderId: linkId,
      planId: null,
      rankId: null,
      itemType: 'rank',
      planName: purpose || 'Premium Rank Payment',
      amount: parseFloat(amount),
      name: customerName.trim(),
      phone: customerPhone.trim(),
      email: customerEmail.trim(),
      utrNumber: null,
      paymentMethod: 'cashfree',
      cashfreeOrderId: String(paymentLink.link_id),
      status: 'awaiting_payment'
    });

    await order.save();

    res.status(201).json({
      success: true,
      linkId: linkId,
      linkUrl: paymentLink.link_url,
      amount: amount,
      expiresAt: paymentLink.link_expiry_time,
    });
  } catch (error) {
    console.error('Payment link creation error:', error.message);
    res.status(500).json({ message: 'Failed to create payment link. ' + error.message });
  }
});

// GET /api/cashfree/verify-link/:linkId - Verify payment link status
router.get('/verify-link/:linkId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.linkId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // If already approved, return immediately
    if (order.status === 'approved') {
      return res.json({
        success: true,
        orderId: order.orderId,
        status: order.status,
        planName: order.planName,
        amount: order.amount,
      });
    }

    // Check link status from Cashfree
    try {
      const linkStatus = await cashfreeService.getLinkStatus(order.orderId);
      console.log('Link status response:', JSON.stringify(linkStatus, null, 2));

      if (linkStatus && linkStatus.link_status === 'PAID') {
        // Get payment details
        const payments = linkStatus.link_orders || [];
        const successfulPayment = payments.find(p => p.order_status === 'PAID');

        if (successfulPayment) {
          // Approve order
          const io = req.app.get('io');
          const approved = await approveOrder(
            order.orderId,
            successfulPayment.cf_order_id || linkStatus.link_id,
            'SUCCESS',
            'payment_link',
            order.amount,
            io
          );

          return res.json({
            success: true,
            orderId: order.orderId,
            status: 'approved',
            planName: order.planName,
            amount: order.amount,
          });
        }
      }
    } catch (cfError) {
      console.log('Cashfree link status check failed:', cfError.message);
    }

    res.json({
      success: false,
      orderId: order.orderId,
      status: order.status,
      message: 'Payment is being processed.',
    });
  } catch (error) {
    console.error('Link verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/cashfree/verify/:orderId - Verify payment status after redirect
router.get('/verify/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // If already approved (by webhook), return immediately
    if (order.status === 'approved') {
      return res.json({
        success: true,
        orderId: order.orderId,
        status: order.status,
        planName: order.planName,
        amount: order.amount,
      });
    }

    // If webhook hasn't arrived yet, poll Cashfree directly
    try {
      const payments = await cashfreeService.getOrderStatus(order.orderId);
      if (payments && payments.length > 0) {
        const successfulPayment = payments.find(p =>
          p.payment_status === 'SUCCESS'
        );

        if (successfulPayment) {
          // Verify amount matches
          if (successfulPayment.payment_amount !== undefined &&
              Math.abs(successfulPayment.payment_amount - order.amount) > 0.01) {
            console.error(`VERIFY AMOUNT MISMATCH: Order ${order.orderId}`);
            return res.json({
              success: false,
              orderId: order.orderId,
              status: 'failed',
              message: 'Payment amount mismatch. Please contact support.',
            });
          }

          // Approve atomically (same helper as webhook — prevents double email)
          const io = req.app.get('io');
          const approved = await approveOrder(
            order.orderId,
            successfulPayment.cf_payment_id,
            successfulPayment.payment_status,
            successfulPayment.payment_group,
            successfulPayment.payment_amount,
            io
          );

          return res.json({
            success: true,
            orderId: order.orderId,
            status: 'approved',
            planName: order.planName,
            amount: order.amount,
          });
        }
      }
    } catch (cfError) {
      console.log('Cashfree verification poll failed:', cfError.message);
    }

    res.json({
      success: false,
      orderId: order.orderId,
      status: order.status,
      message: 'Payment is being processed. You will receive confirmation shortly.',
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
