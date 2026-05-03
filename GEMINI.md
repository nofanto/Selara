# Scenia — Project Instructions & Architecture

This file contains team-shared architecture, conventions, and security mandates for the Scenia project.

## Security Architecture — Zero-Knowledge Sharable Links

The "Sharable Links" feature uses a Zero-Knowledge model to ensure that user data remains private, even from Scenia's own servers and administrators.

### Core Mandates
1.  **Client-Side Encryption:** All workspace data MUST be encrypted in the browser using the Web Crypto API (AES-GCM 256-bit) before being transmitted.
2.  **Key Isolation:** The encryption key MUST NEVER be sent to the server. It is stored exclusively in the URL hash fragment (`#key=...`), which browsers do not include in HTTP requests.
3.  **High-Entropy IDs:** Storage IDs for shared links MUST be at least 16 random bytes (32 hex characters) to prevent unguessable ID brute-forcing.
4.  **Payload Limits:** The server MUST enforce a strict 1MB size limit on encrypted payloads to prevent resource abuse.
5.  **CORS Restriction:** The backend sharing service MUST only allow requests from the production domain `https://scenia.website`.
6.  **Explicit TTL:** Shared links expire after 1 week (168 hours). The backend MUST explicitly check the `expiresAt` timestamp and return `410 Gone` if the link has expired.

## Engineering Standards

- **Tech Stack:** React (TypeScript), Tailwind CSS, Vite, Playwright for E2E testing.
- **Persistence:** Primary local storage is IndexedDB (using the `idb` library).
- **Testing:** Follow the SDLC guide in `docs/scenia-sdlc-guide.md`. Every feature MUST have a corresponding user story in `docs/user-stories/` and passing E2E tests in `e2e/`.
- **Accessibility:** All UI components should follow WCAG 2.1 AA standards where possible. Use `data-testid` for test selectors.
