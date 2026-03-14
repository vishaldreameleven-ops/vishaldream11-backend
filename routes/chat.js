const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const ChatSession = require('../models/ChatSession');
const User = require('../models/User');
const { getChatResponse } = require('../services/geminiService');
const { getTeamStatus } = require('../services/teamStatusService');

const TEAM_KEYWORDS = [
  // English
  'team', 'players', 'lineup', 'squad', 'captain', 'vice captain',
  'playing xi', 'playing 11', 'combination', 'player list', 'my team',
  // Hindi/Hinglish direct
  'meri team', 'mera team', 'team dikhao', 'team batao', 'team bata',
  'team show', 'team do', 'team de do', 'team chahiye', 'team chahie',
  'team chhaiye', 'team dedo', 'team de', 'team bhejo', 'team bhej',
  'team kya hai', 'team kya he', 'team kya h', 'mujhe team',
  'kaun khele', 'which players', 'best team', 'dream team',
  // Common misspellings & phonetic variants
  'teem', 'teaam', 'teaem', 'tream', 'taem', 'teym',
  // Standalone Hindi words that almost always mean "show me the team"
  'khiladi', 'players do', 'players batao', 'players dikhao',
  'lineup do', 'squad do', 'xi do', 'xi batao',
];

function isTeamRequest(message) {
  const lower = message.toLowerCase().trim();
  // Keyword match
  if (TEAM_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Catch "chahiye / chahie / chhaiye / dedo" near any cricket word
  const wantWords = ['chahiye', 'chahie', 'chhaiye', 'dedo', 'de do', 'bhejo', 'dikhao', 'batao', 'show'];
  const cricketWords = ['team', 'teem', 'teym', 'squad', 'player', 'xi', 'lineup'];
  const hasWant = wantWords.some(w => lower.includes(w));
  const hasCricket = cricketWords.some(w => lower.includes(w));
  return hasWant && hasCricket;
}

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

    // Run AI + optional team status fetch in parallel
    const isTeamMsg = isTeamRequest(message.trim());
    const [reply, teamData] = await Promise.all([
      getChatResponse(user, historyBeforeNewMsg, message.trim()),
      isTeamMsg ? getTeamStatus(user.phone).then(s => ({ isTeamRequest: true, ...s })) : Promise.resolve(null),
    ]);

    // Add model reply
    session.messages.push({ role: 'model', content: reply });
    await session.save();

    res.json({ reply, sessionId: session._id, title: session.title, teamData });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ message: 'Failed to send message', details: err.message });
  }
});

// GET /api/chat/team-status - get current rank/team status for the user
router.get('/team-status', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('phone');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const status = await getTeamStatus(user.phone);
    res.json(status);
  } catch (err) {
    console.error('Team status error:', err);
    res.status(500).json({ message: 'Failed to fetch team status' });
  }
});

module.exports = router;
