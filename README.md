# Selara: IT Portfolio Planning & Roadmap Visualiser

**Selara is open source**, available under the Apache 2.0 licence. Whether you want to self-host, contribute, or just explore — you're welcome here.

Selara is a powerful, interactive visualiser designed for IT strategic planning. It allows teams to map out initiatives across different IT assets, track dependencies, and identify scheduling conflicts in a clean, timeline-based interface.

Selara is a fork of [Scenia](https://github.com/waylonkenning/scenia) by Waylon Kenning.

**[⭐ Star on GitHub](https://github.com/nofanto/Selara)**

## 🚀 Key Features

- **Interactive Timeline:** Drag the edges of initiative bars to change their duration directly in the visualiser.
- **Asset Organisation:** Group initiatives by IT Asset and categorise assets. Drag and drop asset categories to reorder your view.
- **Dependency Tracking:** Visualise relationships between initiatives with dynamic SVG-based dependency arrows.
- **Version History:** Save point-in-time snapshots of your entire plan, compare changes between versions, and restore previous states.
- **Conflict Detection:** Automatically identifies overlapping initiatives on the same asset and highlights them.
- **Real-time Persistence:** All changes are saved instantly to your browser's IndexedDB, ensuring your data remains across sessions.
- **Data Management:** Full CRUD operations for Assets, Initiatives, Milestones, and more, including Excel import/export capabilities.

## 🛠 Tech Stack

- **Frontend:** React 19 with TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **Build Tool:** Vite
- **Storage:** IndexedDB (via the `idb` library) for robust client-side data persistence.

## 🏗 Architecture

### Visualiser View (`src/components/Timeline.tsx`)
The core of the application. It uses a custom layout engine to position initiatives without overlapping within an asset's row. It employs a high-performance SVG layer for rendering dependency arrows that stay connected even as you move or resize initiatives.

### Data Management (`src/components/DataManager.tsx`)
A secondary view that allows for bulk editing of the underlying data in a table format.

### Persistence Layer (`src/lib/db.ts`)
Manages the connection to IndexedDB, providing a local-first experience that works without a complex backend while still being more robust than `localStorage`.

## 🚢 Deployment

**TBD.** This fork inherited a `Dockerfile` and `cloudbuild.yaml` from Scenia (Docker image served via Nginx on port 8080, built for Google Cloud Build / Cloud Run), but no hosting target has been set up for Selara yet. Don't assume a push to this repo deploys anywhere — that was Scenia's original Cloud Build trigger pointing at `scenia.website`, which is Waylon Kenning's infrastructure, not this fork's. See `CLAUDE.md`'s Deployment Targets section for the current state.

## 💻 Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/nofanto/Selara.git
    cd Selara
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the development server:**
    ```bash
    npm run dev
    ```
4.  **Run tests:**
    ```bash
    npm test
    ```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## 📜 License

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text. This project is a derivative work of [Scenia](https://github.com/waylonkenning/scenia), also Apache 2.0 licensed.
