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
    required: function() {
      return this.paymentMethod === 'upi_manual';
    },
    trim: true,
    uppercase: true,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['upi_manual', 'cashfree'],
    default: 'upi_manual'
  },
  cashfreeOrderId: {
    type: String,
    default: null
  },
  cashfreePaymentId: {
    type: String,
    default: null
  },
  cashfreePaymentStatus: {
    type: String,
    default: null
  },
  cashfreePaymentMode: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['awaiting_payment', 'pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Unique index on utrNumber but allow nulls (for Cashfree orders)
orderSchema.index({ utrNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Order', orderSchema);
