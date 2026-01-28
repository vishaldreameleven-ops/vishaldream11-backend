const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  period: {
    type: String,
    required: true,
    default: 'one-time'
  },
  description: {
    type: String,
    required: true
  },
  features: [{
    type: String
  }],
  imageUrl: {
    type: String,
    default: ''
  },
  popular: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 50
  },
  discountLabel: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Plan', planSchema);
