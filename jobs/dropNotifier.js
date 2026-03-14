const cron = require('node-cron');
const Order = require('../models/Order');
const { notifyPaymentDropped } = require('../services/telegramService');

// Runs every 15 minutes — finds orders stuck in awaiting_payment > 20 mins
function startDropNotifier() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      const droppedOrders = await Order.find({
        status: 'awaiting_payment',
        telegramNotifiedDrop: false,
        createdAt: { $lt: cutoff },
      }).limit(50);

      for (const order of droppedOrders) {
        await notifyPaymentDropped(order);
        await Order.updateOne(
          { _id: order._id },
          { $set: { telegramNotifiedDrop: true } }
        );
        console.log(`Drop notification sent for order: ${order.orderId}`);
      }

      if (droppedOrders.length > 0) {
        console.log(`Drop notifier: processed ${droppedOrders.length} dropped orders`);
      }
    } catch (err) {
      console.error('Drop notifier cron error (non-critical):', err.message);
    }
  });

  console.log('Drop notifier cron started (runs every 15 min)');
}

module.exports = { startDropNotifier };
