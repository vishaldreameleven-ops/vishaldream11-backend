const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  upiId: {
    type: String,
    required: true,
    default: 'example@upi'
  },
  upiName: {
    type: String,
    required: true,
    default: 'Dream11 Tips'
  },
  telegramLink: {
    type: String,
    default: 'https://t.me/dream11tips'
  },
  whatsappNumber: {
    type: String,
    default: '+917041508202'
  },
  contactNumber: {
    type: String,
    default: '+917041508202'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
