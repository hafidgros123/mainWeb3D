# EllenBot Animated Link 3D

A React + Vite project that combines a themed game portal, a Gemini-powered chat assistant, and a 3D interactive experience. The app includes a landing screen, game catalogue, anime updates page, and an overlay chat that can trigger animations in the 3D scene.

## Features

- Intro screen with a looping video and skip/play flow
- Main project hub with navigation to games, 3D experience, and anime content
- Game list and per-game pages using React Router
- Chat overlay with Gemini integration and function-calling support
- 3D scene and animation controls powered by Three.js
- Anonymous browser session handling and lightweight request limiting on the backend
- Demo-style aesthetic with custom random image overlays and animated UI

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
│   ├── components/
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
CHAT_SESSION_SECRET=your_long_random_secret
# Optional: only set this in production behind a trusted reverse proxy
# TRUST_PROXY_HOPS=1
```

Notes:
- `GEMINI_API_KEY` is required for the chat backend to call the Gemini API.
- `CHAT_SESSION_SECRET` signs the anonymous chat session cookie.
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
- The chat overlay sends user messages to the backend at `/api/chat`.
- The backend validates input, applies rate limits, signs session cookies, and forwards requests to Gemini.
- If a chat command includes a valid tool action such as a character animation, the backend returns a function call that the client can handle.
- The 3D page reads scene state from the Zustand store and updates the animation state in the browser.

## Development notes

- Route configuration lives in `src/App.jsx`.
- Chat UI belongs in `src/components/chat/`.
- Gemini API logic and chat route definitions live in `src/lib/gemini.js`.
- 3D animation names and scene-related helpers live in `src/three/`.
- Game definitions are kept under `src/gamesData/`.

## Production and deployment

- Use the backend as the API boundary for Gemini requests.
- Keep the frontend free of production secrets.
- If the app is deployed behind a proxy, set `TRUST_PROXY_HOPS` to the real number of proxy hops.
- Ensure the host used by the backend CORS configuration matches your deployed frontend origin if applicable.

## License

This project is currently without a formal license declaration in the repository.

