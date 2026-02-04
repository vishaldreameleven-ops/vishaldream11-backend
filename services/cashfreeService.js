const { Cashfree, CFEnvironment } = require('cashfree-pg');

// Initialize Cashfree SDK instance
const cfEnv = process.env.CASHFREE_ENV === 'production'
  ? CFEnvironment.PRODUCTION
  : CFEnvironment.SANDBOX;

const cashfreeClient = new Cashfree(cfEnv);
cashfreeClient.XClientId = process.env.CASHFREE_APP_ID;
cashfreeClient.XClientSecret = process.env.CASHFREE_SECRET_KEY;

const cashfreeService = {
  /**
   * Create a Cashfree order
   */
  async createOrder({ orderId, amount, customerName, customerEmail, customerPhone, returnUrl }) {
    const request = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: `cust_${customerPhone}`,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: returnUrl + '?order_id={order_id}',
      },
    };

    const response = await cashfreeClient.PGCreateOrder(request);

    if (!response || !response.data) {
      throw new Error('Empty response from Cashfree');
    }

    if (!response.data.payment_session_id) {
      throw new Error('No payment_session_id in Cashfree response');
    }

    return response.data;
  },

  /**
   * Get payment status for an order
   */
  async getOrderStatus(orderId) {
    const response = await cashfreeClient.PGOrderFetchPayments(orderId);

    if (!response || !response.data) {
      return [];
    }

    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(timestamp, rawBody, signature) {
    try {
      cashfreeClient.PGVerifyWebhookSignature(signature, rawBody, timestamp);
      return true;
    } catch (error) {
      console.error('Webhook signature verification failed:', error.message);
      return false;
    }
  }
};

module.exports = cashfreeService;
