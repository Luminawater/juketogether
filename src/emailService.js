// Email Service for JukeTogether
// Handles sending transactional emails via Zoho Mail SMTP

const nodemailer = require('nodemailer');

// Initialize email transporter
let transporter = null;

function initializeEmailService() {
  const email = process.env.JUKETOGETHER_ZOHO_EMAIL;
  const password = process.env.JUKETOGETHER_ZOHO_EMAIL_PASSWORD;
  const smtpHost = process.env.JUKETOGETHER_ZOHO_SMTP_HOST || 'smtp.zoho.eu';
  const smtpPort = parseInt(process.env.JUKETOGETHER_ZOHO_SMTP_PORT || '587');
  const smtpSecure = process.env.JUKETOGETHER_ZOHO_SMTP_SECURE === 'true';

  if (!email || !password) {
    console.warn('⚠️  Email service not configured: Missing JUKETOGETHER_ZOHO_EMAIL or JUKETOGETHER_ZOHO_EMAIL_PASSWORD');
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: email,
        pass: password,
      },
    });

    console.log('✅ Email service initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize email service:', error.message);
    return false;
  }
}

// Verify email connection
async function verifyEmailConnection() {
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email connection verification failed:', error);
    return false;
  }
}

// Send receipt email to user after subscription purchase
async function sendReceiptEmail(userEmail, userName, tier, amount, currency = 'USD', paymentDate) {
  if (!transporter) {
    console.warn('Email service not initialized, skipping receipt email');
    return false;
  }

  const tierDisplayName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .receipt-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #667eea;
        }
        .amount {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
          margin: 10px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎵 JukeTogether</h1>
        <p>Thank you for your subscription!</p>
      </div>
      <div class="content">
        <h2>Hello ${userName || 'there'}!</h2>
        <p>Thank you for upgrading to <strong>${tierDisplayName}</strong> tier. Your subscription is now active!</p>
        
        <div class="receipt-box">
          <h3>Payment Receipt</h3>
          <p><strong>Tier:</strong> ${tierDisplayName}</p>
          <p><strong>Amount:</strong> <span class="amount">${formattedAmount}</span></p>
          <p><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
          <p><strong>Status:</strong> <span style="color: #28a745;">✓ Paid</span></p>
        </div>

        <p>You now have access to all ${tierDisplayName} tier features. Enjoy your enhanced JukeTogether experience!</p>
        
        <p>If you have any questions, feel free to reach out to us.</p>
        
        <div class="footer">
          <p>Best regards,<br>The JukeTogether Team</p>
          <p>This is an automated receipt. Please keep this email for your records.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
JukeTogether - Subscription Receipt

Hello ${userName || 'there'}!

Thank you for upgrading to ${tierDisplayName} tier. Your subscription is now active!

Payment Receipt:
- Tier: ${tierDisplayName}
- Amount: ${formattedAmount}
- Payment Date: ${new Date(paymentDate).toLocaleDateString()}
- Status: Paid

You now have access to all ${tierDisplayName} tier features. Enjoy your enhanced JukeTogether experience!

If you have any questions, feel free to reach out to us.

Best regards,
The JukeTogether Team

This is an automated receipt. Please keep this email for your records.
  `;

  try {
    const info = await transporter.sendMail({
      from: `"JukeTogether" <${process.env.JUKETOGETHER_ZOHO_EMAIL}>`,
      to: userEmail,
      subject: `JukeTogether - ${tierDisplayName} Subscription Receipt`,
      text: textContent,
      html: htmlContent,
    });

    console.log('✅ Receipt email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send receipt email:', error);
    return false;
  }
}

// Send new subscriber notification to admin email
async function sendNewSubscriberNotification(userEmail, userName, tier, amount, currency = 'USD') {
  if (!transporter) {
    console.warn('Email service not initialized, skipping notification email');
    return false;
  }

  const adminEmail = process.env.JUKETOGETHER_ADMIN_EMAIL || 'mail@juketogether.com';
  const tierDisplayName = tier.charAt(0).toUpperCase() + tier.slice(1);
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .info-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #28a745;
        }
        .amount {
          font-size: 24px;
          font-weight: bold;
          color: #28a745;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>🎉 New Subscriber!</h2>
      </div>
      <div class="content">
        <p>A new user has subscribed to JukeTogether!</p>
        
        <div class="info-box">
          <h3>Subscription Details</h3>
          <p><strong>User:</strong> ${userName || 'Unknown'} (${userEmail})</p>
          <p><strong>Tier:</strong> ${tierDisplayName}</p>
          <p><strong>Amount:</strong> <span class="amount">${formattedAmount}</span></p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
New Subscriber Notification

A new user has subscribed to JukeTogether!

Subscription Details:
- User: ${userName || 'Unknown'} (${userEmail})
- Tier: ${tierDisplayName}
- Amount: ${formattedAmount}
- Date: ${new Date().toLocaleDateString()}
  `;

  try {
    const info = await transporter.sendMail({
      from: `"JukeTogether" <${process.env.JUKETOGETHER_ZOHO_EMAIL}>`,
      to: adminEmail,
      subject: `🎉 New ${tierDisplayName} Subscriber: ${userName || userEmail}`,
      text: textContent,
      html: htmlContent,
    });

    console.log('✅ New subscriber notification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send new subscriber notification:', error);
    return false;
  }
}

module.exports = {
  initializeEmailService,
  verifyEmailConnection,
  sendReceiptEmail,
  sendNewSubscriberNotification,
};

