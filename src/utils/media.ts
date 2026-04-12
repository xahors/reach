/**
 * Matrix Media Decryption Utilities
 * Based on the Matrix specification for encrypted attachments
 */

export interface EncryptedFile {
  url: string;
  key: {
    kty: string;
    alg: string;
    k: string;
    key_ops: string[];
  };
  iv: string;
  hashes: {
    sha256: string;
  };
  v: string;
}

/**
 * Decrypts a Matrix encrypted file and returns a Blob URL
 */
export async function decryptFile(file: EncryptedFile): Promise<Blob> {
  // 1. Fetch the encrypted data
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`Failed to fetch encrypted file: ${response.statusText}`);
  
  const encryptedBuffer = await response.arrayBuffer();

  // 2. Decode the key (base64url)
  const keyData = {
    ...file.key,
    key_ops: ['decrypt', 'encrypt'],
  };

  const key = await window.crypto.subtle.importKey(
    'jwk',
    keyData as JsonWebKey,
    { name: 'AES-CTR' },
    false,
    ['decrypt']
  );

  // 3. Decode IV (base64)
  const iv = base64ToUint8Array(file.iv);

  // 4. Decrypt
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-CTR',
      counter: iv,
      length: 64, // Matrix uses 64-bit counter
    } as unknown as AesCtrParams,
    key,
    encryptedBuffer
  );

  // 5. Return as Blob
  return new Blob([decryptedBuffer]);
}

/**
 * Helper to convert base64 (standard or URL) to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Handle missing padding
  const paddedBase64 = standardBase64.padEnd(standardBase64.length + (4 - standardBase64.length % 4) % 4, '=');
  const binaryString = window.atob(paddedBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to unpadded base64 (standard)
 */
function encodeBase64Unpadded(uint8: Uint8Array): string {
  let binaryString = '';
  for (let i = 0; i < uint8.length; i++) {
    binaryString += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binaryString).replace(/=+$/g, '');
}

/**
 * Encrypts a file for Matrix E2EE
 */
export async function encryptFile(file: Blob): Promise<{ buffer: ArrayBuffer; info: Omit<EncryptedFile, 'url'> }> {
  // 1. Generate key and IV
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-CTR', length: 256 },
    true,
    ['encrypt', 'decrypt']
  ) as CryptoKey;
  
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  // Matrix uses 64-bit counter, so the last 8 bytes of IV should be 0
  for (let i = 8; i < 16; i++) iv[i] = 0;

  // 2. Encrypt
  const buffer = await file.arrayBuffer();
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-CTR',
      counter: iv,
      length: 64,
    } as unknown as AesCtrParams,
    key,
    buffer
  );

  // 3. Hash the encrypted data
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encryptedBuffer);
  const hashBase64 = encodeBase64Unpadded(new Uint8Array(hashBuffer));

  // 4. Export key as JWK
  const jwk = await window.crypto.subtle.exportKey('jwk', key) as JsonWebKey;

  return {
    buffer: encryptedBuffer,
    info: {
      key: {
        kty: jwk.kty || 'oct',
        alg: jwk.alg || 'A256CTR',
        k: jwk.k || '', // subtle crypto already exports unpadded base64url for 'k'
        key_ops: ['encrypt', 'decrypt'],
      },
      iv: encodeBase64Unpadded(iv),
      hashes: {
        sha256: hashBase64,
      },
      v: 'v2',
    }
  };
}
