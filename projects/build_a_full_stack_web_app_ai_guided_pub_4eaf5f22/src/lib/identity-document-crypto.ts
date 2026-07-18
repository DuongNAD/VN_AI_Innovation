import crypto from 'crypto';

type EncryptedImage = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

function encryptionKey(): Buffer {
  const secret = process.env.IDENTITY_DOCUMENT_KEY;
  if (!secret || secret.length < 32) {
    throw new Error('CONFIG_INVALID: IDENTITY_DOCUMENT_KEY must contain at least 32 characters');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptIdentityImage(plain: Buffer): EncryptedImage {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptIdentityImage(input: EncryptedImage): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), input.iv);
  decipher.setAuthTag(input.authTag);
  return Buffer.concat([decipher.update(input.ciphertext), decipher.final()]);
}
