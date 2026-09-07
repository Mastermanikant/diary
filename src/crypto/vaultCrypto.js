/**
 * FrankDiary Cryptographic Engine (WebCrypto API)
 * Zero-Knowledge, Client-Side Authenticated Encryption (AES-256-GCM + PBKDF2/Argon2 Parameters)
 */

const KDF_ITERATIONS = 120000; // NIST recommended PBKDF2-SHA256 iterations
const AES_KEY_LENGTH = 256;
const SALT_BYTE_LENGTH = 16;
const NONCE_BYTE_LENGTH = 12; // 96-bit standard for AES-GCM

/**
 * Memory zeroization helper to overwrite secret buffers in RAM
 */
export function zeroize(buffer) {
  if (buffer && buffer instanceof Uint8Array) {
    buffer.fill(0);
  }
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive Master Key from Passphrase / PIN and Salt
 */
export async function deriveKeyFromPassphrase(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(passphrase);

  // Import raw passphrase as base key material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // Derive AES-GCM 256-bit encryption key
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false, // Non-extractable key handle in C++ memory
    ['encrypt', 'decrypt']
  );

  // Clear plaintext passphrase from local memory
  zeroize(passwordBytes);

  return derivedKey;
}

/**
 * Encrypt arbitrary JavaScript Object or String with AES-256-GCM
 */
export async function encryptPayload(key, plaintextData) {
  const enc = new TextEncoder();
  const plaintextString = typeof plaintextData === 'string' ? plaintextData : JSON.stringify(plaintextData);
  const plaintextBytes = enc.encode(plaintextString);

  const nonce = generateRandomBytes(NONCE_BYTE_LENGTH);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128,
    },
    key,
    plaintextBytes
  );

  return {
    nonce: bufferToBase64(nonce.buffer),
    ciphertext: bufferToBase64(ciphertextBuffer),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext payload
 */
export async function decryptPayload(key, encryptedBlob) {
  const nonce = new Uint8Array(base64ToBuffer(encryptedBlob.nonce));
  const ciphertext = base64ToBuffer(encryptedBlob.ciphertext);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        tagLength: 128,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedBuffer);

    try {
      return JSON.parse(jsonString);
    } catch {
      return jsonString;
    }
  } catch (err) {
    throw new Error('DECRYPTION_FAILED: Invalid passphrase or corrupted ciphertext');
  }
}

/**
 * Create an Authenticated Encrypted Backup Container (.fbe / Encrypted JSON)
 */
export async function createEncryptedBackupFile(passphrase, entries, metadata = {}) {
  const salt = generateRandomBytes(SALT_BYTE_LENGTH);
  const key = await deriveKeyFromPassphrase(passphrase, salt);

  const containerPayload = {
    schema_version: 1,
    export_timestamp: new Date().toISOString(),
    generator: 'FrankDiary v1.0.0 (FrankBase Ecosystem)',
    metadata,
    entries,
  };

  const encrypted = await encryptPayload(key, containerPayload);

  return {
    format: 'FRANKDIARY_ENCRYPTED_BACKUP_V1',
    magic: 'FBED',
    kdf: 'PBKDF2-SHA256-120K',
    cipher: 'AES-256-GCM-128',
    salt: bufferToBase64(salt.buffer),
    nonce: encrypted.nonce,
    ciphertext: encrypted.ciphertext,
  };
}

/**
 * Restore from Authenticated Encrypted Backup Container
 */
export async function restoreEncryptedBackupFile(passphrase, backupObject) {
  if (backupObject.magic !== 'FBED' && backupObject.format !== 'FRANKDIARY_ENCRYPTED_BACKUP_V1') {
    throw new Error('INVALID_BACKUP_FORMAT: Not a valid FrankDiary backup file');
  }

  const saltBytes = new Uint8Array(base64ToBuffer(backupObject.salt));
  const key = await deriveKeyFromPassphrase(passphrase, saltBytes);

  const decryptedContainer = await decryptPayload(key, {
    nonce: backupObject.nonce,
    ciphertext: backupObject.ciphertext,
  });

  return decryptedContainer;
}

/**
 * Hash secret answer for emergency time-delayed reset
 */
export async function hashSecretAnswer(answerText, saltBytes) {
  const enc = new TextEncoder();
  const normalized = answerText.trim().toLowerCase();
  const data = enc.encode(normalized);
  
  // Combine salt + answer
  const combined = new Uint8Array(saltBytes.length + data.length);
  combined.set(saltBytes);
  combined.set(data, saltBytes.length);

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
  return bufferToBase64(hashBuffer);
}
