const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');

const firestore = new Firestore();
const COLLECTION = 'shared_workspaces';

/**
 * Cloud Function to handle Zero-Knowledge storage for Scenia.
 */
exports.handleShare = async (req, res) => {
  // Set CORS headers
  const origin = req.get('origin');
  const allowedOrigin = 'https://scenia.website';
  
  if (origin === allowedOrigin || !origin) {
    res.set('Access-Control-Allow-Origin', allowedOrigin);
  }
  
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    if (req.method === 'POST') {
      const { ciphertext, iv } = req.body;

      if (!ciphertext || !iv) {
        return res.status(400).send('Missing ciphertext or iv');
      }

      // Payload size limit: 1MB (string length check is sufficient for base64/JSON)
      if (ciphertext.length > 1024 * 1024) {
        return res.status(413).send('Payload too large (max 1MB)');
      }

      // Generate a strong, unique ID (16 bytes = 32 hex chars)
      const id = crypto.randomBytes(16).toString('hex');
      
      // Set TTL for 7 days (168 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 168);

      await firestore.collection(COLLECTION).doc(id).set({
        ciphertext,
        iv,
        expiresAt: Firestore.Timestamp.fromDate(expiresAt),
        createdAt: Firestore.Timestamp.now()
      });

      return res.status(200).json({ id });
    } 
    
    if (req.method === 'GET') {
      const id = req.query.id || req.path.split('/').pop();
      
      if (!id || id === '/') {
        return res.status(400).send('Missing ID');
      }

      const doc = await firestore.collection(COLLECTION).doc(id).get();

      if (!doc.exists) {
        return res.status(404).send('Link expired or not found');
      }

      const data = doc.data();

      // Explicitly check TTL (in case Firestore TTL policy hasn't run)
      if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        return res.status(410).send('This link has expired');
      }

      return res.status(200).json({
        ciphertext: data.ciphertext,
        iv: data.iv
      });
    }

    res.status(405).send('Method Not Allowed');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
};
