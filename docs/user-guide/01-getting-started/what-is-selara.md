# What is Selara?

![Selara overview](../../public/tutorial/1-overview.png)

Selara is a browser-based IT portfolio planning tool. It gives you a single interactive timeline where you can visualise initiatives, map dependencies between them, and track the lifecycle of the software applications that underpin your portfolio.

## Who it's for

Selara is built for IT portfolio managers who need a clear, shared view of what's being built, when it's happening, and how work connects across programmes and strategies. It replaces static spreadsheets and slide decks with a live canvas you can explore and update directly.

## How your data stays private

All data is stored locally in your browser using IndexedDB. Nothing is sent to a server. There is no account, no login, and no cloud sync. Your portfolio data never leaves your machine unless you explicitly export it.

This means:

- You can use Selara on a corporate network without any data leaving the browser.
- There is no vendor lock-in — your data is yours and can be exported to Excel at any time.
- If you clear your browser storage, your data will be lost. Use [Version History](../10-version-history/saving-a-version.md) or [Excel Export](../11-import-export/excel-export.md) to back up your work.

## Working with multiple tabs

If you open the same workspace in more than one browser tab, edit in one tab and the others refresh automatically — you'll see a brief "Updated in another tab" notice. This still never leaves your browser; tabs only stay in sync with each other locally. Treat one tab as the one you're actively editing in at a time — Selara doesn't merge simultaneous edits made in two tabs at once, so if you edit in two tabs around the same time, whichever saves last wins.

## Open source

Selara is open source under the Apache 2.0 licence, forked from [Scenia](https://github.com/waylonkenning/scenia) by Waylon Kenning. The source code is available on GitHub.

---

**Next:** [First Launch](first-launch.md)
