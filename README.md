# EllenBot

React and Vite app for Ellen's game menu, chat assistant, and 3D experience.


## Source map

All application code belongs in `src/`. Use the folder that matches the job:

| Folder | Put here | Current contents |
| --- | --- | --- |
| `src/app` | Reserved for app-wide setup when it is needed | Empty, currently omitted |
| `src/components/chat` | Chat button, window, messages, and chat styles | EllenBot chat UI |
| `src/components/shared` | Reusable components that are not specific to one page | `ErrorBoundary.jsx` |
| `src/gamesData` | Game definitions and game-specific data | `gameDefinitions.js` |
| `src/lib` | External-service clients and general utilities | Gemini client |
| `src/pages` | Route-level screens | Main menu and 3D screen |
| `src/pages/games` | Game listing and individual game screens | Game list and game route |
| `src/store` | Zustand application state | Progress and scene stores |
| `src/three` | Three.js scene code and animation definitions | Animation names |
| `src/assets` | Images, cursors, models, and other imported media | Ellen and user artwork |

`src/App.jsx` owns the route table. `src/main.jsx` is the browser entry point. `src/App.css` owns the app visual system; `src/index.css` only contains browser-level resets.

## Adding a game

1. Add its id, number, and title in `src/games/gameDefinitions.js`.
2. Put its route UI in `src/pages/games/`.
3. Put a Unity build at `public/unity/<game-id>/` when the public folder is created.
4. Connect the finished-game event to `src/store/progressionStore.js`.

## Adding chat behavior

Keep chat UI in `src/components/chat/`. Keep Gemini requests and tool declarations in `src/lib/gemini.js`. Do not put chat files directly in `src/components/`.

## Adding 3D behavior

Keep animation names and Three.js helpers in `src/three/`. Use `src/store/sceneStore.js` for communication between chat commands and the 3D scene.

## Environment

Create `serverless-side/.env` for the backend with:

```env
GEMINI_API_KEY=your_key_here
CHAT_SESSION_SECRET=your_long_random_secret
# Set only when deployed behind a known proxy; use its exact hop count.
# TRUST_PROXY_HOPS=1
```

`CHAT_SESSION_SECRET` signs anonymous chat-session cookies. In production, configure a stable random secret of at least 32 bytes. The development server generates a temporary secret if it is omitted.

Never commit `.env` or expose a production Gemini key in a public frontend. Use a backend proxy for a deployed app.
