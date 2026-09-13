/**
 * Cryptographic Utilities for Phase 5 PIN Protection & Token Sealing
 * Built on standard Web Crypto API (W3C), natively supported in modern browsers,
 * Node.js (19+), serverless, and edge runtimes. Zero external dependencies.
 */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  throw new Error('Standard Web Crypto API is not available in this runtime.');
}

// Generate random hex salt (default 16 bytes = 32 hex chars)
export function generateSalt(bytes: number = 16): string {
  const cryptoObj = getCrypto();
  const arr = new Uint8Array(bytes);
  cryptoObj.getRandomValues(arr);
  return bytesToHex(arr);
}

// Generate random 6-digit numeric PIN
export function generateRandomPin(digits: number = 6): string {
  const cryptoObj = getCrypto();
  const arr = new Uint8Array(digits);
  cryptoObj.getRandomValues(arr);
  let pin = '';
  for (let i = 0; i < digits; i++) {
    pin += (arr[i] % 10).toString();
  }
  return pin;
}

// Generate unique public form identifier, e.g. "pub_k8a2b9"
export function generatePublicFormId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const cryptoObj = getCrypto();
  const arr = new Uint8Array(8);
  cryptoObj.getRandomValues(arr);
  let id = 'pub_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(arr[i] % chars.length);
  }
  return id;
}

// Compute SHA-256 hash of (salt + ':' + pin)
export async function hashPin(pin: string, salt: string): Promise<string> {
  const normalizedPin = pin.trim();
  const dataToHash = `${salt}:${normalizedPin}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(dataToHash);
  const cryptoObj = getCrypto();
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

// Synchronous PIN hash fallback for Node.js backend
export function hashPinSync(pin: string, salt: string): string {
  try {
    const nodeCrypto = (globalThis as any).require ? (globalThis as any).require('crypto') : null;
    if (nodeCrypto && nodeCrypto.createHash) {
      return nodeCrypto.createHash('sha256').update(`${salt}:${pin.trim()}`).digest('hex');
    }
  } catch {
    // Ignore
  }
  return '';
}

// Seal (encrypt) the secret capability token using PBKDF2 (10,000 iterations) + AES-256-GCM
export async function sealShareToken(
  shareToken: string,
  pin: string,
  salt: string
): Promise<{ encrypted: string; iv: string; authTag: string }> {
  const encoder = new TextEncoder();
  const normalizedPin = pin.trim();
  const cryptoObj = getCrypto();

  // 1. Import raw PIN as key material
  const baseKey = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(normalizedPin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 2. Derive 256-bit AES-GCM key using PBKDF2 with salt (10,000 rounds)
  const derivedKey = await cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 10000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 3. Generate random 12-byte IV
  const iv = new Uint8Array(12);
  cryptoObj.getRandomValues(iv);

  // 4. Encrypt capability token
  const fullBuffer = await cryptoObj.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encoder.encode(shareToken)
  );

  const fullBytes = new Uint8Array(fullBuffer);
  // Last 16 bytes is standard GCM authentication tag
  const cipherBytes = fullBytes.slice(0, fullBytes.length - 16);
  const tagBytes = fullBytes.slice(fullBytes.length - 16);

  return {
    encrypted: bytesToHex(cipherBytes),
    iv: bytesToHex(iv),
    authTag: bytesToHex(tagBytes),
  };
}

// Unseal (decrypt) the secret capability token using PBKDF2 + AES-256-GCM
export async function unsealShareToken(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string,
  pin: string,
  salt: string
): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const normalizedPin = pin.trim();
    const cryptoObj = getCrypto();

    const baseKey = await cryptoObj.subtle.importKey(
      'raw',
      encoder.encode(normalizedPin),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const derivedKey = await cryptoObj.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 10000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const cipherBytes = hexToBytes(encryptedHex);
    const tagBytes = hexToBytes(authTagHex);
    const combinedBytes = new Uint8Array(cipherBytes.length + tagBytes.length);
    combinedBytes.set(cipherBytes);
    combinedBytes.set(tagBytes, cipherBytes.length);

    const ivBytes = hexToBytes(ivHex);

    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      derivedKey,
      combinedBytes
    );

    return decoder.decode(decryptedBuffer);
  } catch {
    // OperationError when PIN is incorrect or ciphertext/tag is corrupted
    return null;
  }
}
