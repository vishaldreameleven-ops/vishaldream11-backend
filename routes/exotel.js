const express = require('express');
const router = express.Router();
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// In-memory store for active call conversations (keyed by Exotel CallSid)
const activeCalls = new Map();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// System prompt for Gemini
function buildSystemPrompt(metadata) {
  return `You are Priya, a friendly and persuasive customer service executive from 1stRankCome (Dream11 tips service). You are calling a customer who was interested in our service but did not complete their payment.

Your goal: Convince the customer to complete their payment in a natural, friendly phone conversation.

Customer Details:
- Name: ${metadata.customerName || 'the customer'}
- Plan they were interested in: ${metadata.planName || 'our premium tips plan'}
- Amount: ₹${metadata.amount || 'the plan amount'}
- Order ID: ${metadata.orderId || 'N/A'}

About our service:
- We provide expert Dream11 team suggestions for cricket, football, kabaddi matches
- Our experts have years of experience and strong track record
- Thousands of happy customers win real money every day using our tips
- Plans are affordable starting at ₹${metadata.amount || '299'}

Your approach:
1. Greet warmly, confirm you're speaking with the right person
2. Mention they showed interest in the plan recently
3. Highlight 2-3 key benefits
4. Address concerns they raise
5. Guide them to complete payment at 1strankcome.com
6. If not interested, thank them politely and end

Rules:
- Keep responses SHORT — this is a phone call, max 2-3 sentences per turn
- Speak naturally, be warm not robotic
- Use simple English, avoid jargon
- If they say goodbye or not interested, say a warm farewell and end`;
}

// Generate AI response using Gemini
async function getAIResponse(callSid, userMessage, metadata) {
  if (!activeCalls.has(callSid)) {
    activeCalls.set(callSid, { history: [], metadata });
  }

  const callData = activeCalls.get(callSid);
  callData.history.push({ role: 'user', parts: [{ text: userMessage }] });

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const chat = model.startChat({
    history: callData.history.slice(0, -1),
    systemInstruction: buildSystemPrompt(metadata)
  });

  const result = await chat.sendMessage(userMessage);
  const response = result.response.text();

  callData.history.push({ role: 'model', parts: [{ text: response }] });
  return response;
}

// ExoML helper
function exoML(content) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`;
}

function sayAndGather(text, gatherAction) {
  return exoML(`
    <Gather input="speech" action="${gatherAction}" method="POST" timeout="5" speechTimeout="auto" language="en-IN" finishOnKey="#">
      <Say voice="female" language="en-IN">${text}</Say>
    </Gather>
    <Say voice="female" language="en-IN">I didn't catch that. Goodbye, have a great day!</Say>
  `);
}

// Step 1: Called when customer picks up
router.post('/answer', async (req, res) => {
  const { CallSid, From, To } = req.body;
  const metadata = req.query; // passed as query params when initiating call

  console.log(`Exotel call answered: CallSid=${CallSid}, From=${From}`);

  // Store metadata for this call
  activeCalls.set(CallSid, { history: [], metadata });

  const firstMessage = `Hello, am I speaking with ${metadata.customerName || 'you'}? This is Priya calling from 1stRankCome. Is this a good time to talk?`;

  res.set('Content-Type', 'text/xml');
  res.send(sayAndGather(firstMessage, `${BACKEND_URL}/api/exotel/gather?callSid=${CallSid}&customerName=${encodeURIComponent(metadata.customerName || '')}&planName=${encodeURIComponent(metadata.planName || '')}&amount=${metadata.amount || ''}&orderId=${encodeURIComponent(metadata.orderId || '')}`));
});

// Step 2: Called after each customer response
router.post('/gather', async (req, res) => {
  const { CallSid, SpeechResult, confidence } = req.body;
  const metadata = req.query;
  const callSid = req.query.callSid || CallSid;

  console.log(`Exotel gather: callSid=${callSid}, speech="${SpeechResult}"`);

  res.set('Content-Type', 'text/xml');

  if (!SpeechResult || SpeechResult.trim() === '') {
    res.send(exoML(`<Say voice="female" language="en-IN">I'm sorry, I couldn't hear you clearly. Thank you for your time, have a great day!</Say>`));
    activeCalls.delete(callSid);
    return;
  }

  // Check if user wants to end
  const lower = SpeechResult.toLowerCase();
  if (lower.includes('bye') || lower.includes('not interested') || lower.includes('no thanks') || lower.includes('busy')) {
    res.send(exoML(`<Say voice="female" language="en-IN">No problem at all! Thank you for your time. If you change your mind, visit 1strankcome.com. Have a wonderful day!</Say>`));
    activeCalls.delete(callSid);
    return;
  }

  try {
    const aiResponse = await getAIResponse(callSid, SpeechResult, {
      customerName: metadata.customerName,
      planName: metadata.planName,
      amount: metadata.amount,
      orderId: metadata.orderId
    });

    const gatherUrl = `${BACKEND_URL}/api/exotel/gather?callSid=${callSid}&customerName=${encodeURIComponent(metadata.customerName || '')}&planName=${encodeURIComponent(metadata.planName || '')}&amount=${metadata.amount || ''}&orderId=${encodeURIComponent(metadata.orderId || '')}`;

    res.send(sayAndGather(aiResponse, gatherUrl));
  } catch (err) {
    console.error('Exotel gather AI error:', err.message);
    res.send(exoML(`<Say voice="female" language="en-IN">I'm sorry, I'm having technical difficulties. Please visit 1strankcome.com to complete your purchase. Thank you!</Say>`));
    activeCalls.delete(callSid);
  }
});

// Step 3: Call status callback
router.post('/status', async (req, res) => {
  const { CallSid, Status, From, To } = req.body;
  console.log(`Exotel call status: CallSid=${CallSid}, Status=${Status}`);
  activeCalls.delete(CallSid);
  res.json({ received: true });
});

// Trigger outbound call via Exotel API
router.post('/call', async (req, res) => {
  const { phone, customerName, planName, amount, orderId } = req.body;

  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    await triggerExotelCall({ phone, customerName, planName, amount, orderId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Core function to trigger Exotel outbound call
async function triggerExotelCall({ phone, customerName, planName, amount, orderId }) {
  const EXOTEL_API_KEY = process.env.EXOTEL_API_KEY;
  const EXOTEL_API_TOKEN = process.env.EXOTEL_API_TOKEN;
  const EXOTEL_ACCOUNT_SID = process.env.EXOTEL_ACCOUNT_SID;
  const EXOTEL_VIRTUAL_NUMBER = process.env.EXOTEL_VIRTUAL_NUMBER;
  const EXOTEL_SUBDOMAIN = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';

  if (!EXOTEL_API_KEY || !EXOTEL_API_TOKEN) {
    throw new Error('Exotel not configured');
  }

  const answerUrl = `${BACKEND_URL}/api/exotel/answer?customerName=${encodeURIComponent(customerName || '')}&planName=${encodeURIComponent(planName || '')}&amount=${amount || ''}&orderId=${encodeURIComponent(orderId || '')}`;
  const statusUrl = `${BACKEND_URL}/api/exotel/status`;

  const params = new URLSearchParams({
    From: phone,                      // customer number
    To: EXOTEL_VIRTUAL_NUMBER,        // your ExoPhone
    CallerId: EXOTEL_VIRTUAL_NUMBER,  // what customer sees
    Url: answerUrl,
    StatusCallback: statusUrl,
    TimeLimit: '180'
  });

  const url = `https://${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_ACCOUNT_SID}/Calls/connect`;

  const response = await axios.post(url, params.toString(), {
    auth: { username: EXOTEL_API_KEY, password: EXOTEL_API_TOKEN },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  console.log(`Exotel call initiated: ${response.data?.Call?.Sid}`);
  return response.data;
}

module.exports = { router, triggerExotelCall };
