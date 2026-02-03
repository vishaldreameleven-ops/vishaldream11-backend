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
    default: '+918799553196'
  },
  contactNumber: {
    type: String,
    default: '+917016432821'
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
  // Email configuration (using Resend)
  emailSettings: {
    enabled: { type: Boolean, default: false },
    resendApiKey: { type: String, default: '' },
    fromEmail: { type: String, default: 'onboarding@resend.dev' },
    emailFromName: { type: String, default: 'Come Office' },
    // Legacy Gmail fields (kept for backward compatibility)
    emailUser: { type: String, default: '' },
    emailAppPassword: { type: String, default: '' }
  },
  // Rank booking promo image (1:1 aspect ratio)
  rankPromoImage: {
    type: String,
    default: ''
  },
  rankPromoImagePublicId: {
    type: String,
    default: ''
  },
  // Timer deadline for homepage countdown
  timerDeadline: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // Default: 2 days from now
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
