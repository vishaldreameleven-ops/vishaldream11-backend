const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async getEmailConfig() {
    const settings = await Settings.getSettings();
    return settings.emailSettings || {};
  }

  async createTransporter() {
    const config = await this.getEmailConfig();

    if (!config.enabled || !config.emailUser || !config.emailAppPassword) {
      return null;
    }

    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: config.emailUser,
        pass: config.emailAppPassword
      }
    });
  }

  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      const transporter = await this.createTransporter();
      const config = await this.getEmailConfig();

      if (!transporter) {
        console.log('Email service not configured or disabled');
        return { success: false, error: 'Email service not configured' };
      }

      const fromName = config.emailFromName || 'Dream 11 Office';
      const fromEmail = config.emailUser;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        text: text || subject,
        attachments
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Send order placed confirmation
  async sendOrderPlacedEmail(order, settings) {
    const { orderPlacedTemplate } = require('../templates/emails/orderPlaced');

    if (!order.email) {
      console.log('No email provided for order:', order.orderId);
      return { success: false, error: 'No email address' };
    }

    const html = orderPlacedTemplate(order, settings);

    return this.sendEmail({
      to: order.email,
      subject: `Order Confirmed - ${order.orderId} | Dream 11 Office`,
      html
    });
  }

  // Send order approved email with PDF certificate
  async sendOrderApprovedEmail(order, pdfBuffer, settings) {
    const { orderApprovedTemplate } = require('../templates/emails/orderApproved');

    if (!order.email) {
      console.log('No email provided for order:', order.orderId);
      return { success: false, error: 'No email address' };
    }

    const html = orderApprovedTemplate(order, settings);

    return this.sendEmail({
      to: order.email,
      subject: `Payment Approved - Your Guarantee Certificate | Dream 11 Office`,
      html,
      attachments: [
        {
          filename: `Guarantee_Certificate_${order.orderId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
  }
}

// Singleton instance
const emailService = new EmailService();
module.exports = emailService;
