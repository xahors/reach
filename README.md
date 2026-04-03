# Reach 🚀

> [!WARNING]
> **Work in Progress:** Reach is currently in active development. Features are being added and refined daily. Expect frequent updates and potential breaking changes.

Reach is a modern, high-performance, Discord-inspired chat application built on the **Matrix Protocol**. It combines the decentralized, secure foundation of Matrix with a familiar, gamer-centric user experience.

![Reach Banner](https://raw.githubusercontent.com/matrix-org/matrix-js-sdk/master/logo.png) *(Placeholder for app banner/screenshot)*

## ✨ Current Features

- **🎮 Discord-inspired Interface:** Seamless navigation through your Matrix Spaces and Rooms.
- **🛡️ Secure by Default:** Full End-to-End Encryption (E2EE) powered by the high-performance Rust SDK.
- **📞 Integrated VoIP:** Voice and video calling support with a draggable, flexible call interface.
- **💬 Real-time Messaging:** Instant message delivery, local echoes, and real-time member presence.
- **😀 Emoji Support:** Full emoji picker integrated into the chat experience.
- **🧩 Advanced Session Recovery:** Robust support for cross-signing and secure session recovery using Security Phrases.

---

## 🛠 Tech Stack

- **Frontend Framework:** [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Matrix SDK:** [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) + [Rust WASM Crypto](https://github.com/matrix-org/matrix-sdk-crypto-wasm)
- **Icons:** [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v22+ recommended)
- [npm](https://www.npmjs.com/)

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
4. Access the app at `http://localhost:5173`.

---

## 🏗 Project Architecture

- **`src/core/`**: Service singletons for Matrix client and Call management.
- **`src/store/`**: Global application state (active room, space, etc.).
- **`src/hooks/`**: Custom hooks for real-time synchronization and data fetching.
- **`src/components/`**: Modular UI components organized by feature (chat, calls, layout, auth).

---

## 📄 License

This project is licensed under the GPLv3 License. See the `LICENSE` file for details.

---

*Built with ❤️ on the Matrix Protocol.*
