const cron = require('node-cron');
const axios = require('axios');
const Order = require('../models/Order');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// How long to wait before calling (in minutes)
const WAIT_BEFORE_CALL_MINUTES = 20;
// Max call attempts per order
const MAX_CALL_ATTEMPTS = 2;

async function triggerCallForOrder(order) {
  if (!VAPI_API_KEY || !VAPI_PHONE_NUMBER_ID) {
    console.log('Vapi not configured — skipping call for order:', order.orderId);
    return;
  }

  const phoneE164 = '+91' + order.phone;

  const assistantConfig = {
    name: 'Priya',
    model: {
      provider: 'custom-llm',
      url: `${BACKEND_URL}/api/vapi/llm/chat/completions`,
      model: 'gemini-2.0-flash'
    },
    voice: ELEVENLABS_VOICE_ID
      ? { provider: '11labs', voiceId: ELEVENLABS_VOICE_ID }
      : { provider: 'azure', voiceId: 'en-IN-NeerjaNeural' }, // fallback: Indian English voice
    firstMessage: `Hello, am I speaking with ${order.name}? This is Priya calling from 1stRankCome. Is this a good time to talk?`,
    metadata: {
      customerName: order.name,
      planName: order.planName,
      amount: order.amount,
      orderId: order.orderId
    },
    endCallMessage: 'Thank you for your time! Have a great day.',
    serverUrl: `${BACKEND_URL}/api/vapi/webhook`
  };

  try {
    const response = await axios.post(
      'https://api.vapi.ai/call',
      {
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        customer: { number: phoneE164, name: order.name },
        assistant: assistantConfig
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const vapiCallId = response.data?.id;
    console.log(`Call initiated for order ${order.orderId}, vapiCallId: ${vapiCallId}`);

    // Update order: increment attempts, store call ID and timestamp
    await Order.findOneAndUpdate(
      { orderId: order.orderId },
      {
        $inc: { callAttempts: 1 },
        $set: { callAttemptedAt: new Date(), vapiCallId }
      }
    );
  } catch (err) {
    console.error(`Failed to call order ${order.orderId}:`, err.response?.data || err.message);
  }
}

async function checkAndCallAbandonedOrders() {
  try {
    const cutoffTime = new Date(Date.now() - WAIT_BEFORE_CALL_MINUTES * 60 * 1000);

    const abandonedOrders = await Order.find({
      status: { $in: ['awaiting_payment', 'pending'] },
      callAttempts: { $lt: MAX_CALL_ATTEMPTS },
      createdAt: { $lt: cutoffTime },
      phone: { $exists: true, $ne: '' }
    });

    if (abandonedOrders.length === 0) return;

    console.log(`Found ${abandonedOrders.length} abandoned order(s) to call`);

    for (const order of abandonedOrders) {
      // Space out calls by 5 seconds to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
      await triggerCallForOrder(order);
    }
  } catch (err) {
    console.error('Abandoned payment cron error:', err);
  }
}

function startAbandonedPaymentCaller() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    console.log('Running abandoned payment caller check...');
    checkAndCallAbandonedOrders();
  });

  console.log('Abandoned payment caller cron started (runs every 10 min)');
}

module.exports = { startAbandonedPaymentCaller };
