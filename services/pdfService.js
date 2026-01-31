const PDFDocument = require('pdfkit');

class PDFService {
  async generateGuaranteeCertificate(order, settings) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Page dimensions
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 40;

        // --- Header with red curved background ---
        doc.save();
        doc.moveTo(0, 0)
           .lineTo(pageWidth, 0)
           .lineTo(pageWidth, 120)
           .quadraticCurveTo(pageWidth / 2, 160, 0, 120)
           .closePath()
           .fill('#DC2626');
        doc.restore();

        // Red stripe on right side
        doc.save();
        doc.rect(pageWidth - 15, 0, 15, pageHeight).fill('#DC2626');
        doc.restore();

        // Logo circle with COME
        doc.save();
        doc.circle(margin + 40, 60, 35).fill('#FFFFFF');
        doc.fillColor('#DC2626')
           .font('Helvetica-Bold')
           .fontSize(16)
           .text('COME', margin + 15, 52, { width: 50, align: 'center' });
        doc.restore();

        // Company name
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(22)
           .text('COME', margin + 90, 45)
           .fontSize(14)
           .text('HEAD OFFICE', margin + 90, 70);

        // --- Title ---
        doc.fillColor('#DC2626')
           .font('Helvetica-Bold')
           .fontSize(28)
           .text('GUARANTEE LETTER', 0, 180, {
             width: pageWidth,
             align: 'center'
           });

        // --- Office Address ---
        doc.fillColor('#333333')
           .font('Helvetica-Bold')
           .fontSize(9)
           .text('Office address:- ONE BKC TOWER, 12TH& 14TH FLOOR, UNIT 1201 &', margin, 230, {
             width: pageWidth - 2 * margin
           })
           .text('1202 AND 1402, PLOT C-66 G BLOCK BANDRA KURLA COMPLEX,', margin, 242)
           .text('BANDRA EAST MUMBAI 400081', margin, 254);

        // Divider line
        doc.moveTo(margin, 275)
           .lineTo(pageWidth - margin - 15, 275)
           .strokeColor('#CCCCCC')
           .lineWidth(1)
           .stroke();

        // --- Customer Details ---
        const contentTop = 300;

        doc.fillColor('#000000')
           .font('Helvetica')
           .fontSize(12)
           .text(`Dear, ${order.name},`, margin, contentTop);

        doc.text(`Mobile No: ${order.phone}`, margin, contentTop + 30);

        // --- Subject Line ---
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor('#DC2626')
           .text('Subject:- 100% Winning guarantee', margin, contentTop + 65);

        // --- Body Text ---
        const bodyText = `Dear, ${order.name} main aapko aaj hone wale match mein 100% jitaunga. Aap aaj ke match Winner ban jaoge. Ye Come ki Secret website hai ( Dream11booking.com ) Aap is Website ko Google pe bhi Search kar sakte ho.`;

        doc.fillColor('#333333')
           .font('Helvetica')
           .fontSize(11)
           .text(bodyText, margin, contentTop + 100, {
             width: pageWidth - 2 * margin - 20,
             lineGap: 5
           });

        // Important section
        doc.fillColor('#DC2626')
           .font('Helvetica-Bold')
           .fontSize(11)
           .text('Important:- Jitne bhi sare log 1st Rank mein 1 crore jeet rahe hain. Wo sabhi isi Website se Rank Book karwate hain.', margin, contentTop + 170, {
             width: pageWidth - 2 * margin - 20,
             lineGap: 5
           });

        // Guarantee section
        doc.fillColor('#DC2626')
           .text('Guarantee:- Yadi aap kisi karan aaj match nahi jeette ya aapki Rank nahi aati hai to aapko dusre match mein jeeta diya jayega ya aapka paisa Refund kar diya jayega.', margin, contentTop + 220, {
             width: pageWidth - 2 * margin - 20,
             lineGap: 5
           });

        // Order details box
        doc.fillColor('#F3F4F6')
           .roundedRect(margin, contentTop + 290, pageWidth - 2 * margin - 20, 80, 5)
           .fill();

        doc.fillColor('#333333')
           .font('Helvetica')
           .fontSize(10)
           .text(`Order ID: ${order.orderId}`, margin + 15, contentTop + 305)
           .text(`Plan: ${order.planName}`, margin + 15, contentTop + 320)
           .text(`Amount: Rs.${order.amount}`, margin + 15, contentTop + 335)
           .text(`Date: ${new Date().toLocaleDateString('en-IN', {
             day: 'numeric',
             month: 'long',
             year: 'numeric'
           })}`, margin + 15, contentTop + 350);

        // --- Footer Section ---
        const footerTop = pageHeight - 150;

        doc.fillColor('#000000')
           .font('Helvetica-Bold')
           .fontSize(12)
           .text('Thanks, Come Team', margin, footerTop);

        const contactEmail = settings?.emailSettings?.emailUser || 'office@dream11booking.com';
        const contactPhone1 = settings?.whatsappNumber || '+917041508202';
        const contactPhone2 = settings?.contactNumber || '+917041508202';

        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#333333')
           .text(contactEmail, margin, footerTop + 20)
           .text('', margin, footerTop + 35)
           .text(contactPhone1.replace('+91', ''), margin, footerTop + 50)
           .text(contactPhone2.replace('+91', ''), margin, footerTop + 65);

        // --- Official Stamp/Seal ---
        const stampX = pageWidth - margin - 100;
        const stampY = footerTop - 10;

        // Outer circle
        doc.save();
        doc.circle(stampX + 45, stampY + 45, 45)
           .lineWidth(3)
           .strokeColor('#2E7D32')
           .stroke();

        // Inner circle
        doc.circle(stampX + 45, stampY + 45, 38)
           .lineWidth(2)
           .stroke();

        // Stamp text
        doc.fillColor('#2E7D32')
           .font('Helvetica-Bold')
           .fontSize(7)
           .text('100% RANK', stampX + 10, stampY + 15, { width: 70, align: 'center' });

        doc.fontSize(10)
           .text('COME', stampX + 10, stampY + 35, { width: 70, align: 'center' });

        doc.fontSize(8)
           .text('OFFICE', stampX + 10, stampY + 50, { width: 70, align: 'center' });

        doc.fontSize(6)
           .text('BOOKING GUARANTEE', stampX + 10, stampY + 65, { width: 70, align: 'center' });

        doc.restore();

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

const pdfService = new PDFService();
module.exports = pdfService;
