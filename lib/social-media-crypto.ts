import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function sessionSecret() {
  const value = process.env.APP_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('APP_SESSION_SECRET must contain at least 32 characters to protect social media data');
  }
  return value;
}

function encryptionKey() {
  return createHmac('sha256', sessionSecret()).update('viralzoom:social-account-password:v1').digest();
}

export function encryptSocialCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSocialCredential(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error('تعذر فك تشفير بيانات الحساب؛ راجع إعداد مفتاح الجلسة');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

export function createSocialMediaSignature(postId: string, mediaId: string, expiresAt: number) {
  const payload = `v1\n${postId}\n${mediaId}\n${expiresAt}`;
  const signature = createHmac('sha256', sessionSecret()).update(`viralzoom:social-media-public-file:v1\n${payload}`).digest('hex');
  return `${expiresAt}.${signature}`;
}

export function verifySocialMediaSignature(postId: string, mediaId: string, value: string) {
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now || expiresAt > now + 20 * 60) return false;
  const expected = createSocialMediaSignature(postId, mediaId, expiresAt).split('.')[1];
  return timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(expected, 'hex'));
}
