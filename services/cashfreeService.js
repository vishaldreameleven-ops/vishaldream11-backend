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
  },

  /**
   * Create a Cashfree Payment Link (shareable URL)
   */
  async createPaymentLink({ linkId, amount, purpose, customerName, customerEmail, customerPhone, returnUrl, expiryTime }) {
    const request = {
      link_id: linkId,
      link_amount: amount,
      link_currency: 'INR',
      link_purpose: purpose || 'Payment',
      customer_details: {
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_name: customerName,
      },
      link_meta: {
        return_url: returnUrl + '?link_id={link_id}',
        // Use BACKEND_URL for webhook, not FRONTEND_URL
        notify_url: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/cashfree/webhook` : undefined,
      },
      link_expiry_time: expiryTime || null,
      link_notify: {
        send_sms: false,
        send_email: false,
      },
    };

    console.log('Creating payment link with request:', JSON.stringify(request, null, 2));

    try {
      const response = await cashfreeClient.PGCreateLink(request);

      if (!response || !response.data) {
        throw new Error('Empty response from Cashfree');
      }

      return response.data;
    } catch (error) {
      console.error('Cashfree PGCreateLink error:', error.message);
      if (error.response?.data) {
        console.error('Cashfree error details:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  },

  /**
   * Get Payment Link status
   */
  async getLinkStatus(linkId) {
    try {
      console.log('Fetching link status for:', linkId);
      const response = await cashfreeClient.PGFetchLink(linkId);

      // Extract data safely (response is axios response object)
      const data = response?.data;
      console.log('Link status data:', data ? JSON.stringify(data, null, 2) : 'null');

      if (!data) {
        console.log('No data in response');
        return null;
      }

      return data;
    } catch (error) {
      console.error('getLinkStatus error:', error.message);
      // Try to extract error response data if available
      if (error.response?.data) {
        console.error('Error response:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }
};

module.exports = cashfreeService;
