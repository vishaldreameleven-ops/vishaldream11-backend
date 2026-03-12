const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const ChatSession = require('../models/ChatSession');
const User = require('../models/User');
const { getChatResponse } = require('../services/geminiService');

// All routes require user auth
router.use(userAuth);

// GET /api/chat/sessions - list user's sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user.userId })
      .select('_id title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20);
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

// POST /api/chat/sessions - create new session
router.post('/sessions', async (req, res) => {
  try {
    const session = await ChatSession.create({ userId: req.user.userId });
    res.status(201).json(session);
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ message: 'Failed to create session' });
  }
});

// GET /api/chat/sessions/:id - get session with messages
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// DELETE /api/chat/sessions/:id - delete a session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const session = await ChatSession.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ message: 'Session deleted' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ message: 'Failed to delete session' });
  }
});

// POST /api/chat/sessions/:id/message - send message and get AI reply
router.post('/sessions/:id/message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Fetch user for phone (needed to check payment status)
    const user = await User.findById(req.user.userId).select('phone name');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Add user message to session
    session.messages.push({ role: 'user', content: message.trim() });

    // Auto-title the session from the first user message
    if (session.title === 'New Chat' && session.messages.length === 1) {
      session.title = message.trim().slice(0, 50);
    }

    // Get AI response (pass history BEFORE the new message)
    const historyBeforeNewMsg = session.messages.slice(0, -1);
    const reply = await getChatResponse(user, historyBeforeNewMsg, message.trim());

    // Add model reply
    session.messages.push({ role: 'model', content: reply });
    await session.save();

    res.json({ reply, sessionId: session._id, title: session.title });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ message: 'Failed to send message', details: err.message });
  }
});

module.exports = router;
