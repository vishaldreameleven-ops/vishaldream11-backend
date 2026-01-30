const mongoose = require('mongoose');

const rankSchema = new mongoose.Schema({
  rankNumber: {
    type: Number,
    required: true,
    enum: [1, 2, 3],
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discountedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  badgeColor: {
    type: String,
    default: function() {
      const colors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
      return colors[this.rankNumber] || '#FFD700';
    }
  },
  active: {
    type: Boolean,
    default: true
  },
  features: [{
    type: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Rank', rankSchema);
