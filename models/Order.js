const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    default: function() {
      return 'ORD' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();
    }
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: false
  },
  rankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rank',
    required: false
  },
  itemType: {
    type: String,
    enum: ['plan', 'rank'],
    default: 'plan'
  },
  planName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    default: ''
  },
  utrNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// No need for pre-save hook - orderId is auto-generated via default

module.exports = mongoose.model('Order', orderSchema);
