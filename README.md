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
│   ├── config.js
│   ├── server.js
│   └── supabaseAdmin.js
├── src/
│   ├── auth/
│   │   ├── AuthContext.js
│   │   └── AuthProvider.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── main.jsx
│   ├── componentsOverlay/
│   │   ├── chat/
│   ├── lib/
│   │   ├── auth.js
│   │   ├── gemini.js
│   │   └── supabaseClient.js
│   ├── pages/
│   │   ├── 3d envir/
│   │   ├── anime/
│   │   └── games/
│   ├── store/
│   │   ├── progressionStore.js
│   │   └── sceneStore.js
│   └── three/
└── README.md
```

## Architecture

- `src/main.jsx` mounts React and the router. `src/App.jsx` owns the intro
  screen, shared page shell, and lazy-loaded route table.
- `src/auth/AuthProvider.jsx` is the single browser-side owner of the Supabase
  session; `AuthContext.js` provides the `useAuth()` reader. Pages, overlays,
  and comments use the same session instead of creating their own auth
  subscriptions. OAuth users are routed through profile-name setup before their
  generated provider name is used.
- `src/pages/` contains route-level features; `src/componentsOverlay/` contains
  the chat, sign-in, and other shared overlays. `src/lib/` contains integrations
  such as the browser Supabase client, auth-provider helpers, and chat API
  client. `src/store/` contains client-side progression and scene state.
- `serverless-side/server.js` is the Express API entry point and handles API
  routes, rate limits, and Gemini/RAG requests. `config.js` centralizes its
  runtime settings, while `supabaseAdmin.js` is the server-only service-role
  client. Never import that admin client into browser code.
- During local development, Vite forwards `/api` requests to the Express server
  at `localhost:3001`. A production deployment must also host the Express API
  and route `/api` requests to it. Vercel currently hosts only the frontend;
  chat and account deletion will not work there until `/api` is connected to a
  backend. `vercel.json` provides SPA route fallback.
- Route-level lazy loading keeps page code out of the initial bundle. The GLB
  viewer stops its render loop when it is off-screen or the browser tab is
  hidden.

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
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Notes:
- `GEMINI_API_KEY` is required for the chat backend to call the Gemini API.
- Chat requires a signed-in Supabase user. The publishable key is used by the
  browser; keep `SUPABASE_SERVICE_ROLE_KEY` server-side and never commit it.
- Do not commit `.env` to source control.
- In production, use a secure backend proxy instead of exposing a key in the frontend.

### Deploy to Vercel

Import the repository into Vercel and use the Vite framework preset. The
included `vercel.json` serves the built frontend and falls back to `index.html`
for client-side routes. This deploys the frontend and static assets only; it
does not deploy the Express backend.

Add these environment variables in the Vercel project settings for the
Production, Preview, and Development environments as needed:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser build.

The current frontend chat and account-deletion features call `/api` and will
remain unavailable on this frontend-only deployment until a backend is
connected. Do not add service-role or Gemini secrets to Vercel's `VITE_*`
variables. In Supabase **Authentication → URL Configuration**, set the Site
URL to the deployed site and add its Vercel production URL (and any preview
URLs you intend to use) to the allowed Redirect URLs.

### Supabase chat quotas

The chat API enforces a shared limit of 20 Gemini requests per signed-in user
and 100 requests across the whole site per UTC day. These quotas are stored and
atomically checked in Supabase, so they apply across instances of the current
Express backend.
Each request accepted for Gemini processing counts, including requests where
Gemini later returns an error. The additional 30-requests-per-IP/15-minute
burst guard uses process memory, so it is best-effort when the backend runs
across multiple instances.

Before running the backend, open your Supabase project's **SQL Editor**, run
[`supabase_sql/03_chat_daily_limits.sql`](./supabase_sql/03_chat_daily_limits.sql),
and confirm it completes successfully. The API uses the existing server-only
`SUPABASE_SERVICE_ROLE_KEY` to call the quota function. Do not expose that key
to the browser.

### 3) Enable Google, GitHub, Facebook, and Discord sign-in

The sign-in popup includes Google, GitHub, Facebook, and Discord OAuth buttons.
To enable them for your Supabase project:

1. In Supabase, open **Authentication → URL Configuration**. Set the **Site URL**
   to your app's deployed origin and add each app origin to **Redirect URLs**.
   For local development, add `http://localhost:5173`. The app requests a return
   to the current origin after authentication.
2. Open **Authentication → Providers** and enable Google, GitHub, Facebook, and
   Discord.
   Create an OAuth app with each provider and enter its client ID and client
   secret in the corresponding Supabase provider settings.
3. For each provider's OAuth app, set its callback/redirect URL to the Supabase
   callback URL shown in that provider's Supabase settings. This is commonly
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Save the settings and test each button on the local site and the deployed
   site. Keep provider client secrets in Supabase; do not put them in
   `VITE_*` variables or commit them.

The browser uses the existing Supabase client and Supabase JS handles the OAuth
redirect/session exchange. After the redirect, the app's auth listener updates
the signed-in UI. GitHub users who have not chosen a profile name are sent to
the profile page to choose one; the same applies to Google, Facebook, and
Discord users. If OAuth sign-in succeeds but profile editing does not work,
check that the `profiles` table's row-level security policies allow the
signed-in user to create and update their own row.

### 4) Start the local backend

```bash
npm run server
```

This starts the Express API on `http://localhost:3001`.

### 5) Start the frontend

In a second terminal:

```bash
npm run dev
```

Then open `http://localhost:5173` in the browser.

### Run the full app with Docker

Docker builds the frontend and API in containers, so Linux does not need
Node.js, npm, or a host-side `npm install`. The Docker files and Git line
endings are configured to work when you commit from Windows and run the same
repository on Linux. Commit the Docker files and `.env.docker.example`, but
never commit `.env.docker` or any file containing real credentials.

On Windows, if you want to test the Docker setup locally, open PowerShell in
the repository root and create the private environment file:

```powershell
Copy-Item .env.docker.example .env.docker
```

On the Linux machine, install Docker Engine and the Docker Compose plugin,
clone the repository (or pull the latest changes in its existing checkout),
then create its private environment file from the repository root:

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` and fill in the Supabase URL and publishable key, Supabase
service-role key, Gemini API key, and Gemini model. Keep `.env.docker` private;
it is ignored by Git and should be created separately on each machine. The
Vite Supabase values are embedded into the built browser app, so the
publishable key is public by design. Never put a service-role key or Gemini
key in either `VITE_*` variable. `TRUST_PROXY_HOPS=1` is correct for direct
access through the included Nginx container; change it to the actual number of
trusted proxy hops if you put another reverse proxy in front.

Then build and start the app:

```bash
docker compose --env-file .env.docker up --build -d
```

Open `http://localhost:8080`. To stop it, run:

```bash
docker compose down
```

For updates, first pull the changes (`git pull`) and then run
`docker compose --env-file .env.docker up --build -d` again. Compose restarts
the containers automatically if they stop or the Linux machine reboots. The
Docker setup is for running the project yourself; it does not deploy the site
to Vercel.

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
- The chat overlay sends user messages to the backend at `/api/chat` and renders
  Gemini's newline-delimited JSON stream as text arrives, following the latest
  message in the chat window.
- Gamble totals from 0 through 95 can be replayed from chat with commands such as
  `/0` or `/95`. A total of 95 grants admin status after the SQL functions in
  `supabase_sql/gamble_account_functions.sql` have been installed. Totals from
  96 through 100 are intentionally ignored.
- Totals below 6 open a 30-second quiz. A wrong answer or timeout deletes the
  signed-in account through the `delete_my_account` database function.
- The backend validates input, applies shared daily quotas and a best-effort
  per-IP burst limit, and forwards requests to Gemini.
- Chat responses use Gemini's minimal thinking level. The backend streams text
  chunks and sends any command function call in the final stream event.
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
public/models/small version/smoll_ellen.pmx
public/models/small version/smoll_ellen.webp
# or:
public/models/small version/smoll_ellen.mp4
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
