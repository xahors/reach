# Reach: Planned Features Roadmap

This document outlines the features supported by the Matrix specification and `matrix-js-sdk` that are planned for implementation in Reach to achieve feature parity with modern chat platforms like Discord.

## High Priority

### 1. Mentions & Autocomplete
*   **Goal**: Show a list of room members when typing `@` and rooms when typing `#`.
*   **SDK Path**: `room.getMembers()` for users, `client.getRooms()` for public rooms.
*   **UX**: Tab-to-complete, keyboard navigation in the popup list.

### 2. In-App Device Verification (SAS)
*   **Goal**: Transition from "Unverified" to "Trusted" sessions using emoji comparison.
*   **SDK Path**: `client.requestVerification(userId)` and `m.key.verification.start` listeners.
*   **UX**: A modal showing the verification status and the 7-emoji string for cross-device trust.

## Social & Interaction

### 3. Interactive Polls (MSC3381)
*   **Goal**: Allow users to create and vote on polls within a room.
*   **SDK Path**: Sending events with `msgtype: "m.poll.start"`.
*   **UX**: A "Create Poll" button in the formatting ribbon and specialized rendering in the `MessageList`.

### 4. Voice Messages (MSC3245)
*   **Goal**: Send short audio clips with waveform visualization.
*   **SDK Path**: `m.audio` events with `org.matrix.msc3245.voice` metadata.
*   **UX**: Hold-to-record button in `ChatInput`.

## Moderation & Power Users

### 5. Advanced Permissions (Power Levels)
*   **Goal**: UI for managing roles (Admin, Moderator, Member) and specific permissions.
*   **SDK Path**: `client.getStateEvent(roomId, "m.room.power_levels")` and `client.setPowerLevel()`.
*   **UX**: "Permissions" tab in Room Settings.

### 6. User Ignoring (Blocking)
*   **Goal**: Globally ignore users across all devices.
*   **SDK Path**: `client.setIgnoredUsers()`.
*   **UX**: Right-click context menu on user avatars/names.

### 7. Global Server-Side Search
*   **Goal**: Search for messages across all joined rooms.
*   **SDK Path**: `client.search()`.
*   **UX**: An "Everything" filter in the search bar.

---
*Status: Typing Indicators (Feature #1) currently under implementation.*
