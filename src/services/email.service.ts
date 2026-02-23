import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// สร้าง Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * ส่ง OTP ไปยัง email สำหรับ reset password
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  // ถ้าไม่มี SMTP config → log OTP ลง console (dev mode)
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.log(`[DEV] OTP for ${to}: ${otp}`);
    return;
  }

  const mailOptions = {
    from: `"Pharmacy Academy" <${env.SMTP_USER}>`,
    to,
    subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน - Pharmacy Academy',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #014D40, #027B5B); padding: 16px; border-radius: 16px;">
            <span style="font-size: 28px; color: white; font-weight: bold;">💊</span>
          </div>
          <h1 style="font-size: 22px; color: #111827; margin-top: 16px; margin-bottom: 4px;">Pharmacy Academy</h1>
          <p style="color: #6B7280; font-size: 14px; margin: 0;">รีเซ็ตรหัสผ่าน</p>
        </div>

        <div style="background: #F0FDF9; border: 1px solid #D1FAE5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">รหัส OTP ของคุณคือ:</p>
          <div style="font-size: 36px; font-weight: bold; color: #014D40; letter-spacing: 8px; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #6B7280; font-size: 12px; margin: 16px 0 0 0;">รหัสนี้จะหมดอายุใน <strong>10 นาที</strong></p>
        </div>

        <p style="color: #6B7280; font-size: 13px; line-height: 1.6; text-align: center;">
          หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้<br/>
          รหัสผ่านของคุณจะไม่ถูกเปลี่ยนแปลง
        </p>

        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center;">&copy; 2026 Pharmacy Academy</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
