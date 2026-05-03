# User Stories — Sharable Links

## US-SL-01: Generate a Sharable Link (with Consent)

**As an** IT portfolio manager,
**I want** to be informed about how my data is protected before generating a share link,
**so that** I can confidently and securely share my plan.

**Acceptance Criteria:**
- Clicking the "Share" button opens a **Sharing Consent Modal**.
- The modal explains that data is encrypted in the browser (AES-GCM) and then uploaded to the server.
- The modal includes a mandatory checkbox for granting consent.
- The "Generate share link" button is disabled until consent is granted.
- Clicking "Generate share link" triggers client-side encryption of the full IndexedDB workspace payload.
- The encryption key is **never** sent to the server.
- A unique URL is generated containing the storage ID as a query parameter and the encryption key as a URL hash fragment.
- The generated link is automatically copied to the user's clipboard.
- **A "Link Copied!" in-app modal is displayed, explicitly stating that the link will expire in 1 week.**

---

## US-SL-02: Import Data from a Sharable Link

**As a** recipient of a shared link,
**I want** the workspace data to load automatically when I click the link,
**so that** I can view the shared portfolio plan immediately in my browser.

**Acceptance Criteria:**
- When the application loads a URL containing a share ID and a hash key, it automatically initiates the import process.
- **The landing page is skipped, and the user is taken directly into the application.**
- **A "Restoring Data" in-app modal is displayed while the data is being fetched and decrypted.**
- The application fetches the encrypted ciphertext from the serverless endpoint using the provided ID.
- The application extracts the encryption key from the URL hash fragment.
- The ciphertext is decrypted client-side using the extracted key via the Web Crypto API.
- The decrypted JSON payload is validated and then imported into the recipient's local IndexedDB.
- Existing local data is overwritten.
- A success notification is shown, and the UI refreshes to display the imported data.

---

## US-SL-03: Handle Expired or Invalid Links

**As a** user,
**I want** to see a clear error message if a shared link is expired or invalid,
**so that** I understand why the data failed to load.

**Acceptance Criteria:**
- If the serverless endpoint returns an error because the TTL has expired (after 1 week), a clear error message is displayed.
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
