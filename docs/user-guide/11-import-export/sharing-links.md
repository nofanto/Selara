# Sharing Links

Scenia allows you to share your current IT portfolio plan with colleagues using a secure, temporary link. This is the fastest way to collaborate without needing to export files or manage user accounts.

## How to Share

1.  Click the **Share** button in the top navigation bar.
2.  Wait a moment for the encryption and upload process to complete.
3.  A notification will appear saying **"Share link copied to clipboard!"**.
4.  Paste and send the link to your colleague.

## How to Import a Shared Link

When a colleague clicks your shared link, Scenia will:
1.  Open automatically in their browser.
2.  Detect the share ID and encryption key in the URL.
3.  Securely fetch and decrypt the plan.
4.  Load the data directly into their local workspace.

## Zero-Knowledge Security

We take your data privacy seriously. Scenia uses a **Zero-Knowledge Architecture** for sharing:

*   **Client-Side Encryption:** Your plan is encrypted in your browser using the **Web Crypto API (AES-GCM)** before it is ever sent to our servers.
*   **Private Keys:** The encryption key is stored in the URL hash fragment (`#key=...`). Browsers **never** send this hash fragment to any server. 
*   **Temporary Storage:** Shared plans are stored on our servers in an encrypted format and are automatically deleted after **1 week**.

Only people with the full link (including the part after the `#`) can ever view your data. Even Scenia's administrators cannot decrypt or read your shared plans.
