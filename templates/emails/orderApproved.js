const orderApprovedTemplate = (order, settings) => {
  const whatsappNumber = settings?.whatsappNumber?.replace('+91', '') || '7041508202';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Come Office</h1>
        <p style="color: #ffffff; margin: 10px 0 0; font-size: 16px;">Payment Approved!</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <!-- Success Icon -->
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="display: inline-block; width: 70px; height: 70px; background-color: #10B981; border-radius: 50%; line-height: 70px;">
            <span style="color: #ffffff; font-size: 35px;">&#10003;</span>
          </div>
        </div>

        <h2 style="color: #333333; margin: 0 0 20px; text-align: center;">Congratulations, ${order.name}!</h2>

        <p style="color: #666666; font-size: 16px; line-height: 1.6; text-align: center;">
          Your payment has been verified and approved. Welcome to the Come Office family!
        </p>

        <!-- Order Details Box -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 2px solid #10B981; border-radius: 8px; margin: 25px 0;">
          <tr>
            <td style="padding: 25px;">
              <h3 style="color: #059669; margin: 0 0 15px; font-size: 18px;">Your Subscription</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="8">
                <tr>
                  <td style="color: #666666; border-bottom: 1px solid #d1fae5;">Order ID:</td>
                  <td style="color: #333333; font-weight: bold; text-align: right; border-bottom: 1px solid #d1fae5;">${order.orderId}</td>
                </tr>
                <tr>
                  <td style="color: #666666; border-bottom: 1px solid #d1fae5;">Plan:</td>
                  <td style="color: #333333; font-weight: bold; text-align: right; border-bottom: 1px solid #d1fae5;">${order.planName}</td>
                </tr>
                <tr>
                  <td style="color: #666666; border-bottom: 1px solid #d1fae5;">Amount Paid:</td>
                  <td style="color: #10B981; font-weight: bold; text-align: right; border-bottom: 1px solid #d1fae5;">&#8377;${order.amount}</td>
                </tr>
                <tr>
                  <td style="color: #666666;">Status:</td>
                  <td style="color: #10B981; font-weight: bold; text-align: right;">&#10003; Approved</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Certificate Notice -->
        <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #92400E; font-size: 14px; margin: 0;">
            <strong>&#128206; Attachment:</strong> Your official Guarantee Certificate is attached to this email. Please save it for your records.
          </p>
        </div>

        <p style="color: #666666; font-size: 16px; line-height: 1.6;">
          <strong>Next Steps:</strong>
        </p>
        <ul style="color: #666666; font-size: 14px; line-height: 2;">
          <li>Save your Guarantee Certificate (PDF attached)</li>
          <li>Join our WhatsApp group for daily tips</li>
          <li>Contact us for any queries: +91 ${whatsappNumber}</li>
        </ul>

        <!-- CTA Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="https://wa.me/91${whatsappNumber}" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Join WhatsApp Group
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #333333; padding: 25px; text-align: center;">
        <p style="color: #ffffff; font-size: 14px; margin: 0 0 10px;">Thank you for choosing Come Office!</p>
        <p style="color: #999999; font-size: 12px; margin: 0;">
          ONE BKC TOWER, BANDRA KURLA COMPLEX, MUMBAI 400081<br>
          This is an automated email. Please do not reply.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

module.exports = { orderApprovedTemplate };
