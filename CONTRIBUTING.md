# Contributing to Selara

Thank you for your interest in contributing to **Selara**! Selara is a fork of [Scenia](https://github.com/waylonkenning/scenia) by Waylon Kenning, focused on IT portfolio planning with first-class support for regulatory reporting (RPTI). We welcome contributions from the community to help make it better.

## 🚀 How to Contribute

1.  **Fork the Repository:** Create your own fork of the project.
2.  **Create a Branch:** Create a feature branch for your changes (`git checkout -b feat/your-feature`).
3.  **Implement Changes:**
    *   Fulfill the requirements of your chosen task.
    *   Adhere to the existing code style (TypeScript, React, Tailwind CSS).
    *   If the change involves a genuinely ambiguous domain rule (not just a UI feature), raise it in an issue or PR discussion first — see `CLAUDE.md`'s "Design Discussion" step. Selara treats getting business rules right as more important than moving fast on an assumption.
4.  **Test Your Changes:**
    *   UI-facing behavior (a screen, an interaction, a workflow) gets a **Playwright** E2E test in `e2e/`.
    *   Pure logic (a function in `src/lib/` with no DOM dependency) gets a **Vitest** unit test next to it (`*.test.ts`).
    *   Run everything before submitting: `npm test` (E2E) and `npm run test:unit` (unit).
5.  **Submit a Pull Request:** Open a PR against the `main` branch with a clear description of your changes.

## 🧪 Development Methodology

The full development philosophy and lifecycle live in [`CLAUDE.md`](CLAUDE.md) — read that first for anything beyond a small fix. In short:
- Ambiguous domain rules get discussed and decided before code, not guessed at.
- TDD is mandatory: confirm the test fails (Red) before writing the implementation.
- A change is only complete when its correctness is verified by an automated test — at whichever altitude (unit or E2E) matches where the actual risk lives.

## 🛠 Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run E2E tests
npm test

# Run unit tests
npm run test:unit
```

## 📜 Code of Conduct

Please be respectful and professional in all interactions. We aim to foster an inclusive and welcoming environment for everyone.

---
*By contributing to Selara, you agree that your contributions will be licensed under the Apache License 2.0.*
