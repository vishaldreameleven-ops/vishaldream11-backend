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

  async createTransporter(useSecurePort = false) {
    const config = await this.getEmailConfig();

    console.log('=== EMAIL CONFIG CHECK ===');
    console.log('Email enabled:', config.enabled);
    console.log('Email user configured:', !!config.emailUser);
    console.log('Email password configured:', !!config.emailAppPassword);
    console.log('Using secure port 465:', useSecurePort);

    if (!config.enabled) {
      console.log('Email service is DISABLED in settings');
      return null;
    }

    if (!config.emailUser || !config.emailAppPassword) {
      console.log('Email credentials missing');
      return null;
    }

    // Use port 465 with SSL for better compatibility with cloud providers
    // Gmail supports both 587 (STARTTLS) and 465 (SSL)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: useSecurePort ? 465 : 587,
      secure: useSecurePort, // true for 465, false for 587
      auth: {
        user: config.emailUser,
        pass: config.emailAppPassword
      },
      // Add timeout and connection settings for cloud environments
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      // TLS options for better compatibility
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });

    return transporter;
  }

  // Verify SMTP connection - tries both ports
  async verifyConnection() {
    const config = await this.getEmailConfig();

    if (!config.enabled || !config.emailUser || !config.emailAppPassword) {
      return { success: false, error: 'Email service not configured or disabled' };
    }

    // Try both ports
    const portsToTry = [
      { secure: true, port: 465, name: '465 (SSL)' },
      { secure: false, port: 587, name: '587 (STARTTLS)' }
    ];

    let lastError = null;

    for (const portConfig of portsToTry) {
      try {
        console.log(`Verifying SMTP connection on port ${portConfig.name}...`);
        const transporter = await this.createTransporter(portConfig.secure);

        if (!transporter) {
          return { success: false, error: 'Email service not configured or disabled' };
        }

        await transporter.verify();
        console.log(`SMTP connection verified successfully on port ${portConfig.name}!`);
        return { success: true, message: `SMTP connection verified (port ${portConfig.name})` };
      } catch (error) {
        console.error(`SMTP verification failed on port ${portConfig.name}:`, error.message);
        lastError = error;
      }
    }

    // If we get here, both ports failed
    console.error('All SMTP verification attempts failed');
    console.error('Last error:', lastError);

    // Provide helpful error messages
    let helpMessage = lastError?.message || 'Connection failed';
    if (helpMessage.includes('Invalid login') || helpMessage.includes('535')) {
      helpMessage = 'Invalid Gmail credentials. Make sure you are using an App Password (not your regular password). Go to Google Account > Security > 2-Step Verification > App passwords. The app password is 16 characters with no spaces.';
    } else if (helpMessage.includes('ECONNREFUSED') || helpMessage.includes('ETIMEDOUT') || helpMessage.includes('ENOTFOUND')) {
      helpMessage = 'Cannot connect to Gmail SMTP server. This might be a network issue or the hosting provider might be blocking outbound SMTP.';
    } else if (helpMessage.includes('self signed certificate')) {
      helpMessage = 'SSL certificate verification issue.';
    } else if (helpMessage.includes('Username and Password not accepted')) {
      helpMessage = 'Gmail rejected the credentials. Please verify: 1) 2FA is enabled, 2) App Password is correct (16 chars, no spaces), 3) The Gmail account is not locked.';
    }

    return { success: false, error: helpMessage, originalError: lastError?.message };
  }

  async sendEmail({ to, subject, html, text, attachments = [] }) {
    const config = await this.getEmailConfig();

    if (!config.enabled || !config.emailUser || !config.emailAppPassword) {
      console.log('Email service not configured or disabled');
      return { success: false, error: 'Email service not configured' };
    }

    const fromName = config.emailFromName || 'Come Office';
    const fromEmail = config.emailUser;

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || subject,
      attachments
    };

    // Try port 465 (SSL) first - more reliable on cloud providers like Render
    // If that fails, fallback to port 587 (STARTTLS)
    const portsToTry = [true, false]; // true = port 465, false = port 587

    for (const useSecurePort of portsToTry) {
      try {
        console.log('=== SENDING EMAIL ===');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Trying port:', useSecurePort ? '465 (SSL)' : '587 (STARTTLS)');

        const transporter = await this.createTransporter(useSecurePort);

        if (!transporter) {
          console.log('Email service not configured or disabled');
          return { success: false, error: 'Email service not configured' };
        }

        console.log('Attempting to send email...');
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        return { success: true, messageId: info.messageId };
      } catch (error) {
        console.error(`=== EMAIL SEND FAILED (port ${useSecurePort ? '465' : '587'}) ===`);
        console.error(`Failed to send email to ${to}`);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);

        // If this was the last port to try, return the error
        if (!useSecurePort) {
          console.error('All ports failed. Returning error.');
          return { success: false, error: error.message, code: error.code };
        }

        console.log('Trying fallback port...');
      }
    }

    return { success: false, error: 'All connection attempts failed' };
  }

  // Send test email
  async sendTestEmail(toEmail) {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">✅ Email Test Successful!</h1>
        <p>This is a test email from your Come Office application.</p>
        <p>If you received this email, your email configuration is working correctly.</p>
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
