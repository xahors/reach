# Reach

> [!WARNING]
> Work in Progress: Reach is currently in active development. Expect frequent updates and potential breaking changes. Also this is basically vibe coded, fork at your own risk.

<img width="1392" height="772" alt="image" src="https://github.com/user-attachments/assets/11326287-bb71-437a-8639-d0c98dab35a7" />

Reach is a Discord-like chat application built on the Matrix Protocol.

## Current Features

- Discord-like navigation for Matrix Spaces and Rooms.
- End-to-End Encryption (E2EE) support.
- Voice and video calling with a draggable interface.
- Messaging with local echoes and member presence.
- Emoji picker integrated into chat input.
- Cross-signing and session recovery using Security Phrases.

## Tech Stack

- Frontend: React 19 + Vite 8
- Language: TypeScript
- Styling: Tailwind CSS v4
- State Management: Zustand
- Matrix SDK: matrix-js-sdk + Rust WASM Crypto
- Icons: Lucide React

## Getting Started

### Prerequisites
- Node.js (v22+ recommended)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone git@github.com:xahors/reach.git
   cd reach
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Access the app at http://localhost:5173.

## Project Architecture

- src/core/: Service singletons for Matrix client and call management.
- src/store/: Global application state.
- src/hooks/: Hooks for synchronization and data fetching.
- src/components/: UI components organized by feature.

## License

This project is licensed under the GPLv3 License. See the LICENSE file for details.

Built on the Matrix Protocol.
