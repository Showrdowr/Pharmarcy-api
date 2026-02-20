import svgCaptcha from 'svg-captcha';
import { env } from '../../config/env.js';
import crypto from 'crypto';

/**
 * Utility for CAPTCHA generation and verification using HMAC for stateless validation.
 */
export const captchaUtil = {
  /**
   * Generates an SVG captcha and a signed token containing the answer.
   */
  generate() {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 2,
      color: true,
      background: '#f0f9ff', // Light blue background to match UI
      width: 120,
      height: 48,
      fontSize: 40
    });

    // Sign the answer with a secret key to create a stateless token
    // Using captcha-specific secret or falling back to JWT_SECRET
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration
    const dataToSign = `${captcha.text.toLowerCase()}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(dataToSign)
      .digest('hex');

    const token = Buffer.from(`${dataToSign}:${signature}`).toString('base64');

    return {
      svg: captcha.data,
      token,
    };
  },

  /**
   * Verifies the user's answer against the signed token.
   */
  verify(answer: string, token: string): boolean {
    try {
      if (!answer || !token) return false;

      const decoded = Buffer.from(token, 'base64').toString('ascii');
      const [text, expiresAtStr, signature] = decoded.split(':');
      const expiresAt = parseInt(expiresAtStr, 10);

      // Check expiration
      if (Date.now() > expiresAt) return false;

      // Verify signature
      const dataToSign = `${text}:${expiresAtStr}`;
      const expectedSignature = crypto
        .createHmac('sha256', env.JWT_SECRET)
        .update(dataToSign)
        .digest('hex');

      if (signature !== expectedSignature) return false;

      // Compare answer (case-insensitive)
      return answer.toLowerCase() === text.toLowerCase();
    } catch (err) {
      return false;
    }
  },
};
