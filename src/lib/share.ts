import { encryptData, decryptData } from './crypto';

const API_URL = 'https://us-central1-oneview-diagrams.cloudfunctions.net/handleShare';

export interface ShareResult {
  id: string;
  key: string;
  url: string;
}

/**
 * Encrypts the current workspace data and uploads it to the sharing service.
 * @param data The workspace data to share.
 * @returns The share ID and encryption key.
 */
export async function shareWorkspace(data: unknown): Promise<ShareResult> {
  const { ciphertext, iv, key } = await encryptData(data);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ciphertext, iv }),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload workspace: ${response.statusText}`);
  }

  const { id } = await response.json();
  const url = `${window.location.origin}${window.location.pathname}?id=${id}#key=${key}`;

  return { id, key, url };
}

/**
 * Fetches and decrypts a workspace from a share link.
 * @param id The share ID from the URL.
 * @param key The encryption key from the URL hash.
 * @returns The decrypted workspace data.
 */
export async function importSharedWorkspace(id: string, key: string): Promise<unknown> {
  const response = await fetch(`${API_URL}?id=${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('This share link has expired or does not exist.');
    }
    throw new Error(`Failed to fetch shared workspace: ${response.statusText}`);
  }

  const { ciphertext, iv } = await response.json();
  
  try {
    return await decryptData(ciphertext, iv, key);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data. The link might be corrupted.');
  }
}
