import crypto from 'crypto';

// Derive a per-user key using SESSION_SECRET and user-specific salt
function deriveKey(salt: string): Buffer {
  const secret = process.env.SESSION_SECRET || 'change-this-in-production';
  return crypto.scryptSync(secret, salt, 32);
}

export function encryptForUser(userId: string, plaintext: string): string {
  const key = deriveKey(`user:${userId}`);
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Return base64(iv|tag|ciphertext)
  const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return `gcm:${payload}`;
}

export function decryptForUser(userId: string, encrypted: string): string {
  if (!encrypted) return '';
  const key = deriveKey(`user:${userId}`);
  const raw = encrypted.startsWith('gcm:') ? encrypted.slice(4) : encrypted;
  const buf = Buffer.from(raw, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
}

// Utility to check if a string appears to be encrypted by us
export function isEncrypted(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith('gcm:');
}

