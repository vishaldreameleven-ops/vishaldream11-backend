const PDFDocument = require('pdfkit');

class PDFService {
  convertToHindi(text) {
    const hinglishToHindi = {
      'main': 'मैं',
      'aapko': 'आपको',
      'aaj': 'आज',
      'hone wale': 'होने वाले',
      'mein': 'में',
      'jitaunga': 'जितूंगा',
      'Aap': 'आप',
      'ke': 'के',
      'ban': 'बन',
      'jaoge': 'जाओगे',
      'Ye': 'ये',
      'ki': 'की',
      'hai': 'है',
      'is': 'इस',
      'ko': 'को',
      'pe': 'पे',
      'bhi': 'भी',
      'kar': 'कर',
      'sakte': 'सकते',
      'ho': 'हो',
      'Jitne': 'जितने',
      'sabhi': 'सभी',
      'sare': 'सारे',
      'log': 'लोग',
      'jeet': 'जीत',
      'rahe': 'रहे',
      'hain': 'हैं',
      'Wo': 'वो',
      'isi': 'इसी',
      'se': 'से',
      'karwate': 'करवाते',
      'Yadi': 'यदि',
      'kisi': 'किसी',
      'karan': 'कारण',
      'nahi': 'नहीं',
      'jeette': 'जीतते',
      'ya': 'या',
      'aapki': 'आपकी',
      'aati': 'आती',
      'to': 'तो',
      'dusre': 'दूसरे',
      'jeeta': 'जीता',
      'diya': 'दिया',
      'jayega': 'जाएगा',
      'paisa': 'पैसा',
      'denge': 'देंगे'
    };

    let result = text;
    // Replace whole words only
    Object.entries(hinglishToHindi).forEach(([hinglish, hindi]) => {
      const regex = new RegExp(`\\b${hinglish}\\b`, 'g');
      result = result.replace(regex, hindi);
    });

    return result;
  }

  async generateGuaranteeCertificate(order, settings) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40
        });

        // Register Devanagari font for Hindi text support
        const path = require('path');
        const fontPath = path.join(__dirname, '../fonts/NotoSansDevanagari-Regular.ttf');
        doc.registerFont('Devanagari', fontPath);

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

        // Company Logo
        const logoPath = path.join(__dirname, '../assets/come-logo.png');
        doc.image(logoPath, margin + 10, 30, {
          width: 120,
          height: 60,
          fit: [120, 60]
        });

        // Company name
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(14)
           .text('HEAD OFFICE', margin + 140, 55);

        // --- Title ---
        doc.fillColor('#000000')
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
           .fillColor('#000000')
           .text('Subject:- 100% Winning guarantee', margin, contentTop + 65);

        // --- Body Text ---
        const bodyText = `Dear ${order.name}, मैं आपको आज होने वाले Match में 100% जिताऊंगा। आप आज के Match Winner बन जाओगे। ये Come की Secret Website है (1strankcome.com) आप इस Website को Google पे भी Search कर सकते हो।`;

        doc.fillColor('#333333')
           .font('Devanagari')
           .fontSize(11)
           .text(bodyText, margin, contentTop + 100, {
             width: pageWidth - 2 * margin - 20,
             lineGap: 5
           });

        // Important section
        const importantText = 'Important:- जितने भी लोग 1st Rank जीतकर 1 Crore कमा रहे हैं, वो सभी इसी Website से अपनी Rank Book कर रहे हैं।';

        doc.fillColor('#000000')
           .font('Devanagari')
           .fontSize(11)
           .text(importantText, margin, contentTop + 170, {
             width: pageWidth - 2 * margin - 20,
             lineGap: 5
           });

        // Guarantee section
        const guaranteeText = 'Guarantee:- अगर किसी Reason से आज आप Match नहीं जीतते या आपकी Rank नहीं आती, तो आपको Next Match में Win दी जाएगी या आपके पैसे Refund कर दिए जाएंगे।';

        doc.fillColor('#000000')
           .font('Devanagari')
           .text(guaranteeText, margin, contentTop + 220, {
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

        const contactEmail = settings?.emailSettings?.emailUser || 'vishal.comeofficer@gmail.com';
        const contactPhone1 = settings?.whatsappNumber || '+917041508202';
        const contactPhone2 = settings?.contactNumber || '+917041508202';

        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#333333')
           .text(contactEmail, margin, footerTop + 20)
           .text('', margin, footerTop + 35)
           .text(contactPhone1.replace('+91', ''), margin, footerTop + 50)
           .text(contactPhone2.replace('+91', ''), margin, footerTop + 65);

        // --- Enhanced Professional Official Stamp/Seal ---
        const stampX = pageWidth - margin - 120;
        const stampY = footerTop - 30;
        const stampRadius = 58;
        const centerX = stampX + stampRadius;
        const centerY = stampY + stampRadius;

        doc.save();

        // Enhanced multi-layer concentric circles for depth
        // Outermost circle - darkest green
        doc.circle(centerX, centerY, stampRadius)
           .lineWidth(3.5)
           .strokeColor('#0D5016')
           .stroke();

        // Second circle with dash pattern
        doc.circle(centerX, centerY, stampRadius - 5)
           .lineWidth(1.5)
           .strokeColor('#1B5E20')
           .dash(2, { space: 2 })
           .stroke();
        doc.undash();

        // Third circle - medium thick
        doc.circle(centerX, centerY, stampRadius - 9)
           .lineWidth(2.5)
           .strokeColor('#2E7D32')
           .stroke();

        // Fourth circle with subtle dash
        doc.circle(centerX, centerY, stampRadius - 13)
           .lineWidth(1)
           .strokeColor('#388E3C')
           .dash(1, { space: 1 })
           .stroke();
        doc.undash();

        // Fifth circle
        doc.circle(centerX, centerY, stampRadius - 16)
           .lineWidth(2)
           .strokeColor('#43A047')
           .stroke();

        // Innermost circle
        doc.circle(centerX, centerY, stampRadius - 20)
           .lineWidth(1.5)
           .strokeColor('#4CAF50')
           .stroke();

        // Add decorative corner marks around outer circle
        const decorativeDistance = stampRadius + 5;
        const decorativeLength = 6;
        const positions = [0, 90, 180, 270]; // top, right, bottom, left

        positions.forEach(angle => {
          const rad = (angle * Math.PI) / 180;
          const x = centerX + Math.cos(rad) * decorativeDistance;
          const y = centerY + Math.sin(rad) * decorativeDistance;
          const x2 = centerX + Math.cos(rad) * (decorativeDistance + decorativeLength);
          const y2 = centerY + Math.sin(rad) * (decorativeDistance + decorativeLength);

          doc.moveTo(x, y)
             .lineTo(x2, y2)
             .lineWidth(2)
             .strokeColor('#0D5016')
             .stroke();
        });

        // Top arc text - "OFFICIAL GUARANTEE" with improved styling
        doc.fillColor('#0D5016')
           .font('Helvetica-Bold')
           .fontSize(8);

        const topText = '★ OFFICIAL GUARANTEE ★';
        doc.text(topText, stampX, stampY + 12, {
          width: stampRadius * 2,
          align: 'center'
        });

        // Center - Company name with larger, bolder styling
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#0D5016')
           .text('COME', stampX, stampY + stampRadius - 18, {
             width: stampRadius * 2,
             align: 'center'
           });

        // Center - "OFFICE" with improved spacing
        doc.fontSize(12)
           .fillColor('#1B5E20')
           .text('OFFICE', stampX, stampY + stampRadius + 5, {
             width: stampRadius * 2,
             align: 'center'
           });

        // Bottom arc text - "100% RANK BOOKING" with better visibility
        doc.fontSize(7.5)
           .font('Helvetica-Bold')
           .fillColor('#0D5016')
           .text('100% RANK BOOKING', stampX, stampY + stampRadius * 2 - 28, {
             width: stampRadius * 2,
             align: 'center'
           });

        // Add larger decorative stars for emphasis
        doc.fontSize(12)
           .fillColor('#2E7D32')
           .text('★', stampX + 8, stampY + stampRadius - 8)
           .text('★', stampX + stampRadius * 2 - 20, stampY + stampRadius - 8);

        // Add date at bottom with better formatting
        const currentDate = new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#2E7D32')
           .text(currentDate, stampX, stampY + stampRadius * 2 - 12, {
             width: stampRadius * 2,
             align: 'center'
           });

        // Add small decorative dots between circles for texture
        const dotRadius = stampRadius - 10;
        for (let angle = 0; angle < 360; angle += 30) {
          const rad = (angle * Math.PI) / 180;
          const dotX = centerX + Math.cos(rad) * dotRadius;
          const dotY = centerY + Math.sin(rad) * dotRadius;
          doc.circle(dotX, dotY, 1)
             .fillColor('#388E3C')
             .fill();
        }

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
