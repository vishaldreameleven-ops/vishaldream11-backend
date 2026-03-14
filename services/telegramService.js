const axios = require('axios');
const Settings = require('../models/Settings');

async function sendTelegramMessage(text) {
  try {
    const settings = await Settings.getSettings();
    const { botToken, adminChatId, enabled } = settings.telegramBotSettings || {};

    if (!enabled || !botToken || !adminChatId) return;

    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: adminChatId, text, parse_mode: 'HTML' },
      { timeout: 8000 }
    );
  } catch (err) {
    console.error('Telegram send failed (non-critical):', err.message);
  }
}

// Format IST time string
function toIST(date) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

async function notifyPaymentInitiated(order) {
  const text =
    `💳 <b>New Payment Initiated</b>\n\n` +
    `👤 <b>Name:</b> ${order.name}\n` +
    `📞 <b>Phone:</b> ${order.phone}\n` +
    `📧 <b>Email:</b> ${order.email || '—'}\n` +
    `💰 <b>Amount:</b> ₹${order.amount}\n` +
    `📦 <b>Plan:</b> ${order.planName}\n` +
    `🏷️ <b>Type:</b> ${order.itemType || 'plan'}\n` +
    `🕐 <b>Time:</b> ${toIST(order.createdAt || new Date())}\n` +
    `🆔 <b>Order ID:</b> ${order.orderId}`;
  await sendTelegramMessage(text);
}

async function notifyPaymentDropped(order) {
  const minutesAgo = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const text =
    `🚨 <b>Payment DROPPED!</b>\n\n` +
    `👤 <b>Name:</b> ${order.name}\n` +
    `📞 <b>Phone:</b> ${order.phone}\n` +
    `📧 <b>Email:</b> ${order.email || '—'}\n` +
    `💰 <b>Amount:</b> ₹${order.amount}\n` +
    `📦 <b>Plan:</b> ${order.planName}\n` +
    `🏷️ <b>Type:</b> ${order.itemType || 'plan'}\n` +
    `🕐 <b>Started:</b> ${toIST(order.createdAt)}\n` +
    `⏱️ <b>Dropped after:</b> ~${minutesAgo} min\n` +
    `🆔 <b>Order ID:</b> ${order.orderId}\n\n` +
    `⚡ <b>Follow up NOW!</b>`;
  await sendTelegramMessage(text);
}

module.exports = { notifyPaymentInitiated, notifyPaymentDropped };
