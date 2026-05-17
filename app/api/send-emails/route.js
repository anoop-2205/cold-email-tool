import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

function convertMarkdownToHtml(text) {
  if (!text) return '';
  // Convert markdown bold **text** to <strong>text</strong>
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Convert newlines to <br />
  html = html.replace(/\n/g, '<br />');
  
  // Wrap in a clean, modern email container with standard sans-serif font
  return `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 10px 0;">
      ${html}
    </div>
  `;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const emails = formData.get('emails').split(',').map(e => e.trim());
    const subject = formData.get('subject');
    const message = formData.get('message');
    const smtpUser = formData.get('smtpUser');
    const rawSmtpPass = formData.get('smtpPass');
    // Strip all spaces from the App Password if any exist
    const smtpPass = rawSmtpPass ? rawSmtpPass.replace(/\s+/g, '') : '';
    const resumeFile = formData.get('resume');

    // Convert file to Buffer for attachment
    const bytes = await resumeFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create transporter
    // For Gmail, we recommend using 'service: gmail' but allowing custom host for flexibility
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Default to gmail for ease of use
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const results = [];

    // Send emails one by one
    for (const email of emails) {
      if (!email) continue;
      
      try {
        await transporter.sendMail({
          from: smtpUser,
          to: email,
          subject: subject,
          text: message, // Plain text fallback
          html: convertMarkdownToHtml(message), // Beautiful HTML formatted email
          attachments: [
            {
              filename: resumeFile.name,
              content: buffer,
            },
          ],
        });
        results.push({ email, status: 'success' });
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error);
        results.push({ email, status: 'error', message: error.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
