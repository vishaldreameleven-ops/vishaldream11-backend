const express = require('express');
const authMiddleware = require('../middleware/auth');
const Rank = require('../models/Rank');
const Settings = require('../models/Settings');

const router = express.Router();

// Get all active ranks (public)
router.get('/', async (req, res) => {
  try {
    const ranks = await Rank.find({ active: true }).sort({ rankNumber: 1 }).lean();

    // Transform _id to id for frontend compatibility
    const transformedRanks = ranks.map(rank => ({
      id: rank._id.toString(),
      rankNumber: rank.rankNumber,
      name: rank.name,
      originalPrice: rank.originalPrice,
      discountedPrice: rank.discountedPrice,
      badgeColor: rank.badgeColor,
      features: rank.features,
      active: rank.active
    }));

    res.json(transformedRanks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all ranks including inactive (admin)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const ranks = await Rank.find().sort({ rankNumber: 1 }).lean();

    const transformedRanks = ranks.map(rank => ({
      id: rank._id.toString(),
      rankNumber: rank.rankNumber,
      name: rank.name,
      originalPrice: rank.originalPrice,
      discountedPrice: rank.discountedPrice,
      badgeColor: rank.badgeColor,
      features: rank.features,
      active: rank.active
    }));

    res.json(transformedRanks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single rank with payment info (public)
router.get('/:id', async (req, res) => {
  try {
    const rank = await Rank.findById(req.params.id).lean();

    if (!rank) {
      return res.status(404).json({ message: 'Rank not found' });
    }

    const settings = await Settings.getSettings();

    res.json({
      rank: {
        id: rank._id.toString(),
        rankNumber: rank.rankNumber,
        name: rank.name,
        originalPrice: rank.originalPrice,
        discountedPrice: rank.discountedPrice,
        badgeColor: rank.badgeColor,
        features: rank.features
      },
      upiId: settings.upiId,
      upiName: settings.upiName,
      whatsappNumber: settings.whatsappNumber || '+917041508202'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update rank (admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const rank = await Rank.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!rank) {
      return res.status(404).json({ message: 'Rank not found' });
    }

    res.json({
      message: 'Rank updated',
      rank: {
        id: rank._id.toString(),
        ...rank.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Initialize default ranks (admin) - run once
router.post('/init', authMiddleware, async (req, res) => {
  try {
    const rankCount = await Rank.countDocuments();
    if (rankCount === 0) {
      await Rank.insertMany([
        {
          rankNumber: 1,
          name: '1st Rank',
          originalPrice: 6999,
          discountedPrice: 1999,
          badgeColor: '#FFD700',
          features: ['Guaranteed 1st Position', 'Premium Team Analysis', '24/7 Priority Support', 'Winning Strategies'],
          active: true
        },
        {
          rankNumber: 2,
          name: '2nd Rank',
          originalPrice: 5999,
          discountedPrice: 1499,
          badgeColor: '#C0C0C0',
          features: ['Guaranteed 2nd Position', 'Expert Team Tips', 'Priority Support', 'Match Analysis'],
          active: true
        },
        {
          rankNumber: 3,
          name: '3rd Rank',
          originalPrice: 4999,
          discountedPrice: 999,
          badgeColor: '#CD7F32',
          features: ['Guaranteed 3rd Position', 'Winning Teams', 'WhatsApp Support', 'Live Updates'],
          active: true
        }
      ]);

      return res.json({ message: 'Ranks initialized successfully', count: 3 });
    }

    res.json({ message: 'Ranks already exist', count: rankCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
