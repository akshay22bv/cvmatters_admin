# CV Matters Admin

Standalone admin console for [CV Matters](../CV_MATTERS). It talks to the **same API** as the main app (`/api/admin/*` and `/api/auth/*`).

## Setup

1. In **CV Matters** `backend/.env`, set admin emails and allow this app's origin:

   ```env
   ADMIN_EMAILS=you@example.com
   FRONTEND_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5174
   ```

2. Start the CV Matters API (port 4000) and main frontend if you need public CV links.

3. In this folder:

   ```bash
   cp .env.example .env
   npm install
   npm run dev
   ```

4. Open **http://127.0.0.1:5174** and sign in with an `ADMIN_EMAILS` account.

## Scripts

| Command        | Purpose                          |
|----------------|----------------------------------|
| `npm run dev`  | Dev server (proxies `/api` → API) |
| `npm run build`| Production build to `dist/`       |
| `npm run preview` | Preview production build      |

## Deploy

Build with `npm run build` and host `dist/` on any static host. Set `VITE_API_ORIGIN` at build time to your production API, or put the admin app behind a reverse proxy that forwards `/api` to the backend.

This repo is intentionally separate from the main CV Matters monorepo.
