# EllenBot Animated Link 3D

A React + Vite project that combines a themed game portal, a Gemini-powered chat assistant, and a 3D interactive experience. The app includes a landing screen, game catalogue, anime updates page, and an overlay chat that can trigger animations in the 3D scene.

## Features

- Intro screen with a looping video and skip/play flow
- Main project hub with navigation to games, 3D experience, and anime content
- Game list and per-game pages using React Router
- Chat overlay with Gemini integration and function-calling support
- 3D scene and animation controls powered by Three.js
- Repository-backed 3D model gallery with GLB viewers and comments
- Supabase sign-in for chat and lightweight request limiting on the backend
- Demo-style aesthetic with custom random image overlays and animated UI
- Theme-aware sign-in success popup with an animated WebP celebration image
- A 10% route-entry chance for the placeholder glitch page

## Tech stack

- Frontend: React 19, Vite, React Router, Zustand, Three.js
- Backend: Express, Google Generative AI SDK
- Styling: custom CSS modules and component-level styles

## Project structure

```text
.
├── index.html
├── package.json
├── vite.config.js
├── public/
├── serverless-side/
│   └── server.js
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── main.jsx
│   ├── assets/
│   ├── componentsOverlay/
│   │   ├── chat/
│   │   ├── random/
│   │   └── shared/
│   ├── gamesData/
│   ├── lib/
│   │   └── gemini.js
│   ├── pages/
│   │   ├── MainPage.jsx
│   │   ├── ThreeDPage.jsx
│   │   ├── anime/
│   │   └── games/
│   ├── store/
│   │   ├── progressionStore.js
│   │   └── sceneStore.js
│   └── three/
│       └── animations.js
└── README.md
```

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Set up environment variables

Create a file named `serverless-side/.env` in the project root with:

```env
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=your_gemini_model_id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
# Optional: only set this in production behind a trusted reverse proxy
# TRUST_PROXY_HOPS=1
```

Notes:
- `GEMINI_API_KEY` is required for the chat backend to call the Gemini API.
- Chat requires a signed-in Supabase user. The publishable key is used by the
  browser; keep `SUPABASE_SERVICE_ROLE_KEY` server-side and never commit it.
- Do not commit `.env` to source control.
- In production, use a secure backend proxy instead of exposing a key in the frontend.

### 3) Start the local backend

```bash
npm run server
```

This starts the Express API on `http://localhost:3001`.

### 4) Start the frontend

In a second terminal:

```bash
npm run dev
```

Then open `http://localhost:5173` in the browser.

## Available scripts

```bash
npm run dev       # Start the Vite frontend
npm run server    # Start the Express backend
npm run build     # Create a production build
npm run preview   # Preview the production build locally
npm run lint      # Run the project linter
```

## How the app works

- The frontend is served by Vite and uses React Router to switch between pages.
- Users must sign in before the chat input is enabled.
- The chat overlay sends user messages to the backend at `/api/chat`.
- Gamble totals from 0 through 95 can be replayed from chat with commands such as
  `/0` or `/95`. A total of 95 grants admin status after the SQL functions in
  `supabase_sql/gamble_account_functions.sql` have been installed. Totals from
  96 through 100 are intentionally ignored.
- Totals below 6 open a 30-second quiz. A wrong answer or timeout deletes the
  signed-in account through the `delete_my_account` database function.
- The backend validates input, applies rate limits, signs session cookies, and forwards requests to Gemini.
- If a chat command includes a valid tool action such as a character animation, the backend returns a function call that the client can handle.
- The 3D page reads scene state from the Zustand store and updates the animation state in the browser.

## Development notes

- Route configuration lives in `src/App.jsx`.
- Chat UI belongs in `src/componentsOverlay/chat/`.
- Gemini API logic and chat route definitions live in `src/lib/gemini.js`.
- 3D animation names and scene-related helpers live in `src/three/`.
- 3D model files belong in `public/models/`; register each model in `src/pages/3d envir/modelData.js`.
- Game definitions are kept under `src/gamesData/`.

### Adding a 3D model

Put the full `.glb` file in `public/models/`, then put a lightweight preview
in `public/models/small version/` using the same filename without the `.glb`
extension. The app accepts `.webp` images (including animated WebP/GIF-style
animations) and `.mp4` videos. For example:

```text
public/models/hoshimi_miyabi.glb
public/models/small version/hoshimi_miyabi.webp
# or:
public/models/small version/hoshimi_miyabi.mp4
```

Add the model entry to `MODEL_CATALOG` in `src/pages/3d envir/modelData.js`.
The gallery automatically looks for the matching `.webp` first, then `.mp4`;
opening the card loads the full `.glb` model. Videos play muted and loop in the
preview card.

The model detail page uses the existing signed-in comments experience and the
existing `comments.game_id` column. Model comments are stored with a
`model:<model-id>` key, so no extra Supabase table, column, or policy is needed.

Successful sign-ins show a large themed overlay for 20 seconds, with a close
button and the animated `public/goodBoy/good-boy.webp` image. The popup UI is
organized in `src/componentsOverlay/signinSuccess/`. The original GIF can
remain in the public folder, but the app uses the WebP version.

The app has a placeholder glitch route at `/glitched`. Each new route entry has
a 10% chance of redirecting there; assets for the future experience belong in
`public/glitched/`, and the page source is in `src/pages/glitched/`.

The sign-in success music control uses the Becca assets in `public/becca/`:
`becca-music.webp` is the animated playing state and `becca-stopped.webp` is
the stopped state.

## Production and deployment

- Use the backend as the API boundary for Gemini requests.
- Keep the frontend free of production secrets.
- If the app is deployed behind a proxy, set `TRUST_PROXY_HOPS` to the real number of proxy hops.
- Ensure the host used by the backend CORS configuration matches your deployed frontend origin if applicable.

## License

This project is currently without a formal license declaration in the repository.
