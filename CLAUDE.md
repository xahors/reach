# Claude Code Configuration for Reach

Reach is a Discord-like, gamer-focused chat client built on the Matrix protocol — React 19, Vite 8, and Tailwind CSS v4.

## Project Architecture

- **`src/core/`** — Core service singletons. Touch carefully; these are global.
  - `matrix.ts`: `MatrixClient` instance, auth, and E2EE init (Rust WASM Crypto).
  - `callManager.ts`: VoIP logic (voice/video/screenshare) via matrix-js-sdk.
- **`src/store/`** — Global state.
  - `useAppStore.ts`: Zustand store — active room/space, call status, modals.
- **`src/hooks/`** — Matrix data synchronization hooks.
  - `useMatrixSync.ts`: Matrix sync event listener; drives global sync state.
  - `useRoomMessages.ts`: Message timeline, pagination, local echoes.
  - `useGroupCall.ts`: Group call session state.
  - `useSpaces.ts` / `useSpaceRooms.ts`: Fetches Matrix Spaces and child rooms.
- **`src/components/`** — Feature-organized UI.
  - `layout/`: Sidebar (Spaces) and ChannelList (Rooms/DMs).
  - `chat/`: ChatArea, MessageList, MessageItem, ChatInput.
  - `auth/`: Login and Security Recovery (E2EE) flows.
  - `calls/`: ActiveCall overlay, ParticipantTile.
  - `ui/`: Shared UI (SettingsModal, etc.).

## Tech Stack

| Tool | Version | Notes |
|---|---|---|
| React | 19 | Functional components and hooks only |
| Tailwind CSS | v4 | Config in `vite.config.ts` and `src/index.css` |
| matrix-js-sdk | ^41 | Rust WASM Crypto (`@matrix-org/matrix-sdk-crypto-wasm`) |
| Zustand | 5 | Single `useAppStore` for cross-component state |
| Lucide React | latest | All icons |
| TypeScript | ~5.9 | Strict typing expected |
| Vite | 8 | Build tool |

## Working Rules

- **State**: Use `useAppStore` for cross-component state. No prop drilling.
- **Matrix events**: New event types go in the relevant hook (e.g. `useRoomMessages`).
- **E2EE**: Any new message types must be compatible with the encrypted timeline.
- **Layout**: Don't break the Discord-like responsive layout when modifying components.
- **Surgical changes**: Only change what is needed. Don't refactor surrounding code.

## Validation — ALWAYS before committing

```bash
npm run lint    # Fix ALL warnings and errors
npm run build   # Confirm TypeScript types and build pass
```

## Useful Commands

```bash
npm run dev      # Dev server
npm run lint     # ESLint
npm run build    # Type-check + production build
npm run preview  # Preview production build
```
