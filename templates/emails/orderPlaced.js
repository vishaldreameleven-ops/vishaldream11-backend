const orderPlacedTemplate = (order, settings) => {
  const whatsappNumber = settings?.whatsappNumber?.replace('+91', '') || '7041508202';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Dream 11 Office</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #333333; margin: 0 0 20px;">Order Received!</h2>

        <p style="color: #666666; font-size: 16px; line-height: 1.6;">
          Dear <strong>${order.name}</strong>,
        </p>

        <p style="color: #666666; font-size: 16px; line-height: 1.6;">
          Thank you for your order! We have received your payment details and our team is verifying it.
        </p>

        <!-- Order Details Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa; border-radius: 8px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              <h3 style="color: #333333; margin: 0 0 15px; font-size: 18px;">Order Details</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="8">
                <tr>
                  <td style="color: #666666; border-bottom: 1px solid #eee;">Order ID:</td>
                  <td style="color: #333333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${order.orderId}</td>
                </tr>
                <tr>
                  <td style="color: #666666; border-bottom: 1px solid #eee;">Plan:</td>
                  <td style="color: #333333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${order.planName}</td>
                </tr>
                <tr>
                  <td style="color: #666666; border-bottom: 1px solid #eee;">Amount:</td>
                  <td style="color: #DC2626; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">&#8377;${order.amount}</td>
                </tr>
                <tr>
                  <td style="color: #666666; border-bottom: 1px solid #eee;">UTR Number:</td>
                  <td style="color: #333333; font-weight: bold; text-align: right; border-bottom: 1px solid #eee;">${order.utrNumber}</td>
                </tr>
                <tr>
                  <td style="color: #666666;">Status:</td>
                  <td style="color: #F59E0B; font-weight: bold; text-align: right;">Pending Verification</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="color: #666666; font-size: 16px; line-height: 1.6;">
          <strong>What's Next?</strong><br>
          Our team will verify your payment within 30 minutes. Once approved, you will receive your Guarantee Certificate and access to our premium tips.
        </p>

        <p style="color: #666666; font-size: 14px; line-height: 1.6;">
          If you have any questions, contact us on WhatsApp: <strong>+91 ${whatsappNumber}</strong>
        </p>

        <!-- CTA Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="https://wa.me/91${whatsappNumber}" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
                Contact on WhatsApp
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #333333; padding: 25px; text-align: center;">
        <p style="color: #999999; font-size: 12px; margin: 0;">
          Dream 11 Office | Mumbai, India<br>
          This is an automated email. Please do not reply.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

module.exports = { orderPlacedTemplate };
