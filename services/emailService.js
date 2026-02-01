const { Resend } = require('resend');
const Settings = require('../models/Settings');

class EmailService {
  constructor() {
    this.resend = null;
  }

  async getEmailConfig() {
    const settings = await Settings.getSettings();
    return settings.emailSettings || {};
  }

  async getResendClient() {
    const config = await this.getEmailConfig();

    if (!config.enabled) {
      console.log('Email service is DISABLED in settings');
      return null;
    }

    if (!config.resendApiKey) {
      console.log('Resend API key not configured');
      return null;
    }

    return new Resend(config.resendApiKey);
  }

  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      console.log('=== SENDING EMAIL VIA RESEND ===');
      console.log('To:', to);
      console.log('Subject:', subject);

      const config = await this.getEmailConfig();

      if (!config.enabled) {
        console.log('Email service is DISABLED');
        return { success: false, error: 'Email service disabled' };
      }

      if (!config.resendApiKey) {
        console.log('Resend API key not configured');
        return { success: false, error: 'Resend API key not configured. Please add it in Settings.' };
      }

      const resend = new Resend(config.resendApiKey);
      const fromName = config.emailFromName || 'Come Office';
      const fromEmail = config.fromEmail || 'onboarding@resend.dev'; // Default Resend test email

      // Convert attachments format for Resend
      const resendAttachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content // Buffer
      }));

      console.log('Sending via Resend API...');
      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: subject,
        html: html,
        text: text || subject,
        attachments: resendAttachments.length > 0 ? resendAttachments : undefined
      });

      if (error) {
        console.error('Resend API error:', error);
        return { success: false, error: error.message };
      }

      console.log('Email sent successfully!');
      console.log('Message ID:', data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('=== EMAIL SEND FAILED ===');
      console.error('Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Verify connection by checking API key
  async verifyConnection() {
    try {
      const config = await this.getEmailConfig();

      if (!config.enabled) {
        return { success: false, error: 'Email service is disabled' };
      }

      if (!config.resendApiKey) {
        return { success: false, error: 'Resend API key not configured. Get your free API key at https://resend.com' };
      }

      // Test the API key by getting domains (lightweight check)
      const resend = new Resend(config.resendApiKey);
      const { data, error } = await resend.domains.list();

      if (error) {
        if (error.message.includes('API key')) {
          return { success: false, error: 'Invalid Resend API key' };
        }
        return { success: false, error: error.message };
      }

      console.log('Resend API key verified successfully');
      return { success: true, message: 'Resend API connection verified!' };
    } catch (error) {
      console.error('Verification failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Send test email
  async sendTestEmail(toEmail) {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">✅ Email Test Successful!</h1>
        <p>This is a test email from your Come Office application.</p>
        <p>If you received this email, your Resend configuration is working correctly.</p>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `;

    return this.sendEmail({
      to: toEmail,
      subject: 'Test Email - Come Office',
      html
    });
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
      subject: `Order Confirmed - ${order.orderId} | Come Office`,
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
      subject: `Payment Approved - Your Guarantee Certificate | Come Office`,
      html,
      attachments: [
        {
          filename: `Guarantee_Certificate_${order.orderId}.pdf`,
          content: pdfBuffer
        }
      ]
    });
  }
}

// Singleton instance
const emailService = new EmailService();
module.exports = emailService;
