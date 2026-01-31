const express = require('express');
const authMiddleware = require('../middleware/auth');
const Plan = require('../models/Plan');
const Settings = require('../models/Settings');
const cloudinaryService = require('../services/cloudinaryService');

const router = express.Router();

// Get all active plans (public)
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ price: 1 }).lean();

    // Transform _id to id for frontend compatibility
    const transformedPlans = plans.map(plan => ({
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      period: plan.period,
      description: plan.description,
      features: plan.features,
      imageUrl: plan.imageUrl || '',
      popular: plan.popular,
      active: plan.active,
      discount: plan.discount || 0,
      discountLabel: plan.discountLabel || ''
    }));

    res.json(transformedPlans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all plans including inactive (admin)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ createdAt: -1 }).lean();

    const transformedPlans = plans.map(plan => ({
      id: plan._id.toString(),
      name: plan.name,
      price: plan.price,
      period: plan.period,
      description: plan.description,
      features: plan.features,
      imageUrl: plan.imageUrl || '',
      popular: plan.popular,
      active: plan.active,
      discount: plan.discount || 0,
      discountLabel: plan.discountLabel || ''
    }));

    res.json(transformedPlans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single plan with payment info (public)
router.get('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id).lean();

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    const settings = await Settings.getSettings();

    res.json({
      plan: {
        id: plan._id.toString(),
        name: plan.name,
        price: plan.price,
        period: plan.period,
        description: plan.description,
        features: plan.features,
        imageUrl: plan.imageUrl || '',
        popular: plan.popular,
        discount: plan.discount || 0,
        discountLabel: plan.discountLabel || ''
      },
      upiId: settings.upiId,
      upiName: settings.upiName,
      whatsappNumber: settings.whatsappNumber || '+917041508202'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create plan (admin)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const plan = new Plan(req.body);
    await plan.save();

    res.status(201).json({
      message: 'Plan created',
      plan: {
        id: plan._id.toString(),
        ...plan.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update plan (admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Fetch old record BEFORE update
    const oldPlan = await Plan.findById(req.params.id);

    if (!oldPlan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Check if image is being replaced
    const imageChanged = req.body.imageUrl &&
                         req.body.imageUrl !== oldPlan.imageUrl &&
                         oldPlan.imageUrl;

    // Perform update
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    // Clean up old image if replaced (non-blocking)
    if (imageChanged) {
      cloudinaryService.deleteModelImage(
        oldPlan,
        'imageUrl',
        'imagePublicId'
      ).catch(err => {
        console.error(`Failed to delete old image for plan ${req.params.id}:`, err);
      });
    }

    res.json({
      message: 'Plan updated',
      plan: {
        id: plan._id.toString(),
        ...plan.toObject()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete plan (admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Fetch record BEFORE deletion to get image info
    const plan = await Plan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Delete from database first (primary operation)
    await Plan.findByIdAndDelete(req.params.id);

    // Clean up Cloudinary image (non-blocking, fire-and-forget)
    if (plan.imageUrl) {
      cloudinaryService.deleteModelImage(
        plan,
        'imageUrl',
        'imagePublicId'
      ).catch(err => {
        console.error(`Failed to delete image for plan ${req.params.id}:`, err);
      });
    }

    res.json({ message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
