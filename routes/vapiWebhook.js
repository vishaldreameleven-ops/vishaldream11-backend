const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// Vapi sends webhook events here for call status updates
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ received: true });

    const { type, call } = message;
    const vapiCallId = call?.id;
    const metadata = call?.assistant?.metadata || {};
    const orderId = metadata.orderId;

    console.log(`Vapi webhook: type=${type}, callId=${vapiCallId}, orderId=${orderId}`);

    if (type === 'end-of-call-report') {
      const endedReason = call?.endedReason || 'unknown';
      const transcript = message.transcript || '';

      // Determine outcome from ended reason
      let outcome = 'no_answer';
      if (endedReason === 'customer-ended-call') outcome = 'talked';
      else if (endedReason === 'assistant-ended-call') outcome = 'talked';
      else if (endedReason === 'voicemail') outcome = 'voicemail';
      else if (endedReason === 'customer-did-not-answer') outcome = 'no_answer';
      else if (endedReason === 'customer-busy') outcome = 'busy';

      if (orderId) {
        await Order.findOneAndUpdate(
          { orderId },
          {
            $set: {
              callOutcome: outcome,
              vapiCallId
            }
          }
        );
        console.log(`Updated order ${orderId}: outcome=${outcome}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Vapi webhook error:', err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

module.exports = router;
