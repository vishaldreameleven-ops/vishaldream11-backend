const Rank = require('../models/Rank');
const Order = require('../models/Order');
const FantasyTeam = require('../models/FantasyTeam');
const Settings = require('../models/Settings');

/**
 * Parse a matchTime string into a Date object.
 * Returns null if unparseable.
 */
function parseMatchTime(matchTime) {
  if (!matchTime) return null;
  // Try ISO / standard date parse first
  const d = new Date(matchTime);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/**
 * Compute per-rank team status for a given user phone number.
 * Returns rank data, payment status, team data (if unlocked), and timing info.
 */
async function getTeamStatus(userPhone) {
  const [ranks, paidOrders, fantasyTeams, settings] = await Promise.all([
    Rank.find({ active: true }).sort({ rankNumber: 1 }),
    Order.find({ phone: userPhone, status: { $in: ['approved', 'completed'] } }).select('rankId itemType'),
    FantasyTeam.find(),
    Settings.getSettings(),
  ]);

  // Check for any approved order (legacy plan orders count for all ranks)
  const paidRankIds = new Set(
    paidOrders
      .filter(o => o.rankId)
      .map(o => o.rankId.toString())
  );
  const hasLegacyOrder = paidOrders.some(o => !o.rankId || o.itemType === 'plan');

  // Timing: matchTime from settings
  const matchTimeStr = settings?.featuredMatch?.matchTime || null;
  const matchDate = parseMatchTime(matchTimeStr);
  let teamAvailableAt = null;
  let isTimeToReveal = true; // default: no timing gate if unparseable

  if (matchDate) {
    const revealTime = new Date(matchDate.getTime() - 20 * 60 * 1000); // -20 min
    teamAvailableAt = revealTime.toISOString();
    isTimeToReveal = Date.now() >= revealTime.getTime();
  }

  // Build per-rank data
  const rankResults = ranks.map(rank => {
    // Find the best matching fantasy team for this rank:
    // 1. Rank-specific team (rankNumber matches)
    // 2. Fallback to shared team (rankNumber === null)
    const rankSpecificTeam = fantasyTeams.find(t => t.rankNumber === rank.rankNumber);
    const sharedTeam = fantasyTeams.find(t => t.rankNumber == null);
    const team = rankSpecificTeam || sharedTeam || null;

    const lineupAnnounced = team?.lineupAnnounced || false;

    // Payment check: rank-specific payment OR legacy plan order
    const isPaid = hasLegacyOrder || paidRankIds.has(rank._id.toString());

    // Determine availability
    let isAvailable = false;
    let unavailableReason = null;

    if (!isPaid) {
      unavailableReason = 'not_paid';
    } else if (!lineupAnnounced) {
      unavailableReason = 'lineup_pending';
    } else if (!isTimeToReveal) {
      unavailableReason = 'too_early';
    } else {
      isAvailable = true;
    }

    return {
      _id: rank._id.toString(),
      rankNumber: rank.rankNumber,
      name: rank.name,
      originalPrice: rank.originalPrice,
      discountedPrice: rank.discountedPrice,
      badgeColor: rank.badgeColor,
      features: rank.features || [],
      isPaid,
      players: isAvailable && team?.players?.length ? team.players.map(p => ({
        name: p.name,
        role: p.role,
        team: p.team,
        isCaptain: p.isCaptain,
        isViceCaptain: p.isViceCaptain,
      })) : null,
      isAvailable,
      unavailableReason,
    };
  });

  // Global lineupAnnounced — true if any team has it announced
  const anyLineupAnnounced = fantasyTeams.some(t => t.lineupAnnounced);

  return {
    lineupAnnounced: anyLineupAnnounced,
    matchTime: matchTimeStr,
    teamAvailableAt,
    ranks: rankResults,
  };
}

module.exports = { getTeamStatus };
