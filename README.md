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

## Deploy (Vercel)

1. Set build env:
   - `VITE_API_ORIGIN=https://cvmattersbackend.vercel.app`
   - `VITE_APP_ORIGIN=https://cvmatters.net`
2. On the **backend**, include the admin origin in `FRONTEND_ORIGIN` (comma-separated), e.g.  
   `https://cvmatters.net,https://cvmattersadmin.vercel.app`
3. `vercel.json` also rewrites `/api/*` → the backend, so relative `/api` calls work even without baking the origin into the bundle.

This repo is intentionally separate from the main CV Matters monorepo.
