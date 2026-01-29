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
  },
  // Featured match for homepage - synced from admin dashboard
  featuredMatch: {
    team1Name: { type: String, default: 'Mumbai' },
    team1Short: { type: String, default: 'MI' },
    team1Color: { type: String, default: '#004BA0' },
    team2Name: { type: String, default: 'Chennai' },
    team2Short: { type: String, default: 'CSK' },
    team2Color: { type: String, default: '#F9CD05' },
    matchTime: { type: String, default: 'Today 7:30 PM' },
    venue: { type: String, default: 'Wankhede Stadium' },
    tournament: { type: String, default: 'IPL 2026' },
    isLive: { type: Boolean, default: false }
  },
  // Email configuration
  emailSettings: {
    enabled: { type: Boolean, default: false },
    emailUser: { type: String, default: '' },
    emailAppPassword: { type: String, default: '' },
    emailFromName: { type: String, default: 'Dream 11 Office' }
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
