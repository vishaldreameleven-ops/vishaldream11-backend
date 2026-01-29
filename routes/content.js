const express = require('express');
const authMiddleware = require('../middleware/auth');
const VideoProof = require('../models/VideoProof');
const Winner = require('../models/Winner');

const router = express.Router();

// ============ VIDEO PROOFS ============

// Get all active video proofs (public)
router.get('/videos', async (req, res) => {
  try {
    const videos = await VideoProof.find({ active: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const transformedVideos = videos.map(v => ({
      id: v._id.toString(),
      title: v.title,
      amount: v.amount,
      youtubeUrl: v.youtubeUrl,
      thumbnailUrl: v.thumbnailUrl,
      date: v.date
    }));

    res.json(transformedVideos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all video proofs (admin)
router.get('/videos/all', authMiddleware, async (req, res) => {
  try {
    const videos = await VideoProof.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const transformedVideos = videos.map(v => ({
      id: v._id.toString(),
      title: v.title,
      amount: v.amount,
      youtubeUrl: v.youtubeUrl,
      thumbnailUrl: v.thumbnailUrl,
      date: v.date,
      active: v.active,
      order: v.order
    }));

    res.json(transformedVideos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create video proof (admin)
router.post('/videos', authMiddleware, async (req, res) => {
  try {
    const video = new VideoProof(req.body);
    await video.save();

    res.status(201).json({
      message: 'Video proof created',
      video: {
        id: video._id.toString(),
        ...video.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update video proof (admin)
router.put('/videos/:id', authMiddleware, async (req, res) => {
  try {
    const video = await VideoProof.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!video) {
      return res.status(404).json({ message: 'Video proof not found' });
    }

    res.json({ message: 'Video proof updated', video });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete video proof (admin)
router.delete('/videos/:id', authMiddleware, async (req, res) => {
  try {
    const video = await VideoProof.findByIdAndDelete(req.params.id);

    if (!video) {
      return res.status(404).json({ message: 'Video proof not found' });
    }

    res.json({ message: 'Video proof deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ WINNERS ============

// Get all active winners (public)
router.get('/winners', async (req, res) => {
  try {
    const winners = await Winner.find({ active: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const transformedWinners = winners.map(w => ({
      id: w._id.toString(),
      name: w.name,
      amount: w.amount,
      rank: w.rank,
      match: w.match,
      imageUrl: w.imageUrl
    }));

    res.json(transformedWinners);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all winners (admin)
router.get('/winners/all', authMiddleware, async (req, res) => {
  try {
    const winners = await Winner.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const transformedWinners = winners.map(w => ({
      id: w._id.toString(),
      name: w.name,
      amount: w.amount,
      rank: w.rank,
      match: w.match,
      imageUrl: w.imageUrl,
      active: w.active,
      order: w.order
    }));

    res.json(transformedWinners);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create winner (admin)
router.post('/winners', authMiddleware, async (req, res) => {
  try {
    const winner = new Winner(req.body);
    await winner.save();

    res.status(201).json({
      message: 'Winner created',
      winner: {
        id: winner._id.toString(),
        ...winner.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update winner (admin)
router.put('/winners/:id', authMiddleware, async (req, res) => {
  try {
    const winner = await Winner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!winner) {
      return res.status(404).json({ message: 'Winner not found' });
    }

    res.json({ message: 'Winner updated', winner });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete winner (admin)
router.delete('/winners/:id', authMiddleware, async (req, res) => {
  try {
    const winner = await Winner.findByIdAndDelete(req.params.id);

    if (!winner) {
      return res.status(404).json({ message: 'Winner not found' });
    }

    res.json({ message: 'Winner deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ INIT DEFAULT DATA ============

router.post('/init', authMiddleware, async (req, res) => {
  try {
    // No default videos - admin will add them manually

    // Add default winners if none exist
    const winnerCount = await Winner.countDocuments();
    if (winnerCount === 0) {
      await Winner.insertMany([
        { name: 'Rahul K.', amount: '₹2.5L', rank: '1st', match: 'IPL', order: 1 },
        { name: 'Amit S.', amount: '₹1.8L', rank: '1st', match: 'T20 WC', order: 2 },
        { name: 'Vikram P.', amount: '₹3.2L', rank: '1st', match: 'PSL', order: 3 },
        { name: 'Suresh Y.', amount: '₹1.5L', rank: '2nd', match: 'BBL', order: 4 }
      ]);
    }

    res.json({ message: 'Content initialized successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
