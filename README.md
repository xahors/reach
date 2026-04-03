# Reach 🚀

Reach is a modern, high-performance, Discord-inspired chat application built on the **Matrix Protocol**. It combines the decentralized, secure foundation of Matrix with a familiar, gamer-centric user experience.

![Reach Banner](https://raw.githubusercontent.com/matrix-org/matrix-js-sdk/master/logo.png) *(Placeholder for app banner/screenshot)*

## ✨ Key Features

- **🎮 Discord-like Interface:** Familiar navigation with Spaces (Servers), Channels, and Member lists.
- **🛡️ End-to-End Encryption (E2EE):** Full support for secure communication, including cross-signing and session recovery via Security Phrases/Recovery Keys.
- **📞 VoIP (Voice & Video):** Integrated calling capabilities powered by the Matrix SDK.
- **🌌 Matrix Spaces:** First-class support for Spaces to organize your communities and rooms.
- **💬 Real-time Sync:** Instant message delivery and presence updates using the Matrix sync loop.
- **📱 Responsive Design:** Built with Tailwind CSS v4 for a fluid, high-performance UI.
- **🧩 Advanced Crypto:** Leverages `@matrix-org/matrix-sdk-crypto-wasm` for robust, high-performance encryption.

---

## 🛠 Tech Stack

- **Frontend Framework:** [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Matrix SDK:** [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) + [WASM Crypto](https://github.com/matrix-org/matrix-rust-sdk-crypto-js)
- **Icons:** [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
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

### Environment Configuration
The application is pre-configured to work with standard Matrix homeservers. For production deployments, ensure your homeserver supports [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) and the necessary Matrix API versions.

---

## 🏗 Project Architecture

Reach follows a modular architecture designed for performance and maintainability:

- **`src/core/`**: Core logic and service singletons.
  - `matrix.ts`: Matrix client initialization and low-level SDK handling.
  - `callManager.ts`: VoIP call orchestration.
- **`src/store/`**: Centralized state management using Zustand.
- **`src/hooks/`**: Specialized React hooks for Matrix data (e.g., `useMatrixSync`, `useRoomMessages`).
- **`src/components/`**: Feature-organized UI components.
  - `auth/`: Login and Security Recovery.
  - `chat/`: Messaging, lists, and inputs.
  - `calls/`: Active call overlays and controls.
  - `layout/`: Sidebar, Channel List, and Member List.

---

## 🔒 Security & Privacy

Reach prioritizes your privacy:
- **Zero-knowledge Encryption:** Messages are decrypted locally in your browser.
- **WASM-powered Crypto:** Secure and fast cryptographic operations.
- **Local Session Storage:** Your credentials and session tokens are stored securely in the browser's storage.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary. See `package.json` for details.

---

*Built with ❤️ on the Matrix Protocol.*
