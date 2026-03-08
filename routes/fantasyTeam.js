const express = require('express');
const adminAuthMiddleware = require('../middleware/auth');
const userAuthMiddleware = require('../middleware/userAuth');
const FantasyTeam = require('../models/FantasyTeam');
const Order = require('../models/Order');

const router = express.Router();

// GET /api/fantasy-team  (admin only)
router.get('/', adminAuthMiddleware, async (req, res) => {
  try {
    const teams = await FantasyTeam.find().sort({ createdAt: -1 });
    res.json({ teams });
  } catch (error) {
    console.error('Get fantasy teams error:', error);
    res.status(500).json({ message: 'Failed to fetch teams' });
  }
});

// POST /api/fantasy-team  (admin only) - create new team
router.post('/', adminAuthMiddleware, async (req, res) => {
  try {
    const { matchReference, players, teamType, notes } = req.body;

    if (!matchReference || !players || players.length === 0) {
      return res.status(400).json({ message: 'Match reference and players are required' });
    }

    const team = await FantasyTeam.create({
      matchReference,
      players,
      teamType: teamType || 'GL',
      notes,
      lineupAnnounced: false,
    });

    res.status(201).json({ message: 'Fantasy team created', team });
  } catch (error) {
    console.error('Create fantasy team error:', error);
    res.status(500).json({ message: 'Failed to create team' });
  }
});

// PUT /api/fantasy-team/:id  (admin only) - update team
router.put('/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { matchReference, players, teamType, notes } = req.body;

    const team = await FantasyTeam.findByIdAndUpdate(
      req.params.id,
      { matchReference, players, teamType, notes },
      { new: true, runValidators: true }
    );

    if (!team) return res.status(404).json({ message: 'Team not found' });

    res.json({ message: 'Team updated', team });
  } catch (error) {
    console.error('Update fantasy team error:', error);
    res.status(500).json({ message: 'Failed to update team' });
  }
});

// PATCH /api/fantasy-team/:id/toggle-lineup  (admin only)
router.patch('/:id/toggle-lineup', adminAuthMiddleware, async (req, res) => {
  try {
    const team = await FantasyTeam.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    team.lineupAnnounced = !team.lineupAnnounced;
    await team.save();

    res.json({
      message: `Lineup ${team.lineupAnnounced ? 'announced' : 'hidden'}`,
      lineupAnnounced: team.lineupAnnounced,
      team,
    });
  } catch (error) {
    console.error('Toggle lineup error:', error);
    res.status(500).json({ message: 'Failed to toggle lineup' });
  }
});

// GET /api/fantasy-team/eligible  (user only)
router.get('/eligible', userAuthMiddleware, async (req, res) => {
  try {
    // Check payment
    const paidOrder = await Order.findOne({
      phone: req.user.phone,
      status: { $in: ['approved', 'completed'] },
    }).sort({ createdAt: -1 });

    if (!paidOrder) {
      return res.status(403).json({
        eligible: false,
        reason: 'payment_required',
        message: 'Please purchase a plan to view the fantasy team.',
      });
    }

    // Get latest fantasy team
    const team = await FantasyTeam.findOne().sort({ createdAt: -1 });

    if (!team) {
      return res.json({
        eligible: false,
        reason: 'no_team',
        message: 'Fantasy team has not been added yet. Check back soon!',
      });
    }

    if (!team.lineupAnnounced) {
      return res.json({
        eligible: false,
        reason: 'lineup_pending',
        message: 'Lineup has not been announced yet. We will update the team very soon!',
      });
    }

    res.json({
      eligible: true,
      team: {
        matchReference: team.matchReference,
        players: team.players,
        teamType: team.teamType,
        notes: team.notes,
      },
    });
  } catch (error) {
    console.error('Eligible check error:', error);
    res.status(500).json({ message: 'Failed to check eligibility' });
  }
});

// DELETE /api/fantasy-team/:id  (admin only)
router.delete('/:id', adminAuthMiddleware, async (req, res) => {
  try {
    await FantasyTeam.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted' });
  } catch (error) {
    console.error('Delete fantasy team error:', error);
    res.status(500).json({ message: 'Failed to delete team' });
  }
});

module.exports = router;
