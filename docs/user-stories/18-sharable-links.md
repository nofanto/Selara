# User Stories — Sharable Links

## US-SL-01: Generate a Sharable Link

**As an** IT portfolio manager,
**I want** to generate a secure, temporary link to my current workspace,
**so that** I can share my plan with colleagues without them needing to create an account or manually export/import files.

**Acceptance Criteria:**
- Clicking the "Share" button triggers client-side encryption of the full IndexedDB workspace payload.
- Encryption uses the native Web Crypto API (AES-GCM) with a randomly generated 256-bit key.
- The encrypted ciphertext is sent to a serverless storage endpoint (e.g., Cloudflare Worker + KV).
- The encryption key is **never** sent to the server.
- A unique URL is generated containing the storage ID as a query parameter and the encryption key as a URL hash fragment (e.g., `https://scenia.website/import?id=abc-123#key=xyz-789`).
- The generated link is automatically copied to the user's clipboard.
- A success notification is displayed to the user.

---

## US-SL-02: Import Data from a Sharable Link

**As a** recipient of a shared link,
**I want** the workspace data to load automatically when I click the link,
**so that** I can view the shared portfolio plan immediately in my browser.

**Acceptance Criteria:**
- When the application loads a URL containing a share ID and a hash key, it automatically initiates the import process.
- The application fetches the encrypted ciphertext from the serverless endpoint using the provided ID.
- The application extracts the encryption key from the URL hash fragment.
- The ciphertext is decrypted client-side using the extracted key via the Web Crypto API.
- The decrypted JSON payload is validated and then imported into the recipient's local IndexedDB.
- Existing local data is overwritten (or the user is prompted to confirm if data exists).
- A success notification is shown, and the UI refreshes to display the imported data.

---

## US-SL-03: Handle Expired or Invalid Links

**As a** user,
**I want** to see a clear error message if a shared link is expired or invalid,
**so that** I understand why the data failed to load.

**Acceptance Criteria:**
- If the serverless endpoint returns an error (e.g., 404 Not Found) because the TTL has expired (e.g., after 24-48 hours), a clear error message is displayed.
- If the decryption fails (e.g., due to a corrupted or missing key in the URL), a clear "Decryption Failed" error is displayed.
- The error message explains that shared links are temporary and suggests requesting a new link from the sender.

---

## US-SL-04: Security and Privacy Transparency

**As a** security-conscious user,
**I want** to understand how my data is protected when using the "Share" feature,
**so that** I am confident that sensitive portfolio information remains private.

**Acceptance Criteria:**
- The Share modal includes a "Zero-Knowledge" security notice.
- The notice explains that data is encrypted in the browser before being stored.
- The notice explicitly states that the server has no access to the decryption key, as it is only stored in the URL hash fragment which is never sent to the server.
