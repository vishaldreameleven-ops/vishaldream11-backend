const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['BAT', 'BWL', 'AR', 'WK'], required: true },
    team: { type: String, required: true, trim: true },
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false },
  },
  { _id: false }
);

const fantasyTeamSchema = new mongoose.Schema(
  {
    matchReference: {
      type: String,
      required: true,
      trim: true,
    },
    players: [playerSchema],
    teamType: {
      type: String,
      enum: ['GL', 'SL', 'both'],
      default: 'GL',
    },
    lineupAnnounced: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FantasyTeam', fantasyTeamSchema);
