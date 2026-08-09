/**
 * Zero-knowledge encryption module for Selara.
 * Uses the native Web Crypto API (AES-GCM) to encrypt data client-side.
 * The encryption key is never sent to the server.
 */

/**
 * Encrypts a JSON object using AES-GCM.
 * @param jsonObject The data to encrypt.
 * @returns An object containing the base64-encoded ciphertext, iv, and key.
 */
export async function encryptData(jsonObject: unknown): Promise<{ ciphertext: string; iv: string; key: string }> {
  const textEncoder = new TextEncoder();
  const encodedData = textEncoder.encode(JSON.stringify(jsonObject));

  // Generate a random 256-bit AES-GCM key
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Generate a random 12-byte initialization vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedData
  );

  // Export the key and convert to base64
  const exportedKey = await window.crypto.subtle.exportKey('raw', key);
  
  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    key: arrayBufferToBase64(exportedKey),
  };
}

/**
 * Decrypts a base64-encoded ciphertext using a base64-encoded key and iv.
 * @param ciphertext Base64 ciphertext.
 * @param iv Base64 IV.
 * @param key Base64 key.
 * @returns The original JSON object.
 */
export async function decryptData(ciphertext: string, iv: string, key: string): Promise<unknown> {
  const textDecoder = new TextDecoder();
  
  // Import the key
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(key),
    {
      name: 'AES-GCM',
    },
    true,
    ['decrypt']
  );

  // Decrypt the data
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToArrayBuffer(iv),
    },
    importedKey,
    base64ToArrayBuffer(ciphertext)
  );

  return JSON.parse(textDecoder.decode(decryptedBuffer));
}

// --- Helper Functions ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); // URL-safe base64
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Handle URL-safe base64
  const normalizedBase64 = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const pad = normalizedBase64.length % 4;
  const paddedBase64 = pad ? normalizedBase64 + '='.repeat(4 - pad) : normalizedBase64;
  
  const binaryString = window.atob(paddedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
