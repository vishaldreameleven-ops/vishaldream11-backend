const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Vapi calls this endpoint as a "Custom LLM"
// It sends messages in OpenAI format and expects OpenAI-compatible response
router.post('/chat/completions', async (req, res) => {
  try {
    const { messages, call } = req.body;

    // Extract metadata passed from Vapi call (planName, amount, paymentLink)
    const metadata = call?.assistant?.metadata || {};
    const { customerName, planName, amount, orderId } = metadata;

    const systemPrompt = `You are Priya, a friendly and persuasive customer service executive from 1stRankCome (Dream11 tips service). You are calling a customer who was interested in our service but did not complete their payment.

Your goal: Convince the customer to complete their payment in a natural, friendly conversation.

Customer Details:
- Name: ${customerName || 'the customer'}
- Plan they were interested in: ${planName || 'our premium tips plan'}
- Amount: ₹${amount || 'the plan amount'}
- Order ID: ${orderId || 'N/A'}

About our service:
- We provide expert Dream11 team suggestions for cricket, football, kabaddi matches
- Our experts have years of experience and a strong track record
- We guarantee top rank predictions - if you don't get a good rank, we have support
- Thousands of happy customers win real money every day using our tips
- Our team analyzes player form, pitch conditions, match stats before every game
- Plans are affordable - ₹${amount || 'very reasonable'} for expert guidance that can win you much more

Your approach:
1. Greet warmly, introduce yourself
2. Ask if this is a good time to talk (if they say no, politely ask when to call back)
3. Remind them about their interest in the plan
4. Highlight 2-3 key benefits naturally
5. Address any concerns they raise
6. Guide them to complete payment at: https://1strankcome.com
7. If they agree, confirm their order ID so they can easily find their order

Important rules:
- Speak naturally in a mix of Hindi and English (Hinglish) if the customer prefers - start in English
- Be warm, NOT pushy or robotic
- Keep responses SHORT - this is a phone call, not an essay
- If they are not interested, thank them politely and end the call gracefully
- Never make false promises`;

    // Build Gemini conversation from messages (skip system message - we add our own)
    const userMessages = messages.filter(m => m.role !== 'system');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Convert OpenAI message format to Gemini format
    const history = [];
    for (let i = 0; i < userMessages.length - 1; i++) {
      const msg = userMessages[i];
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    const chat = model.startChat({
      history,
      systemInstruction: systemPrompt
    });

    const lastMessage = userMessages[userMessages.length - 1];
    const result = await chat.sendMessage(lastMessage?.content || 'Hello');
    const responseText = result.response.text();

    // Return in OpenAI-compatible format (what Vapi expects)
    res.json({
      id: 'chatcmpl-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini-2.0-flash',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseText
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    });

  } catch (err) {
    console.error('Vapi LLM error:', err);
    res.status(500).json({ error: 'LLM error', details: err.message });
  }
});

module.exports = router;
