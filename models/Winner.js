const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: String,
    required: true
  },
  rank: {
    type: String,
    required: true,
    default: '1st'
  },
  match: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  imagePublicId: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Winner', winnerSchema);
