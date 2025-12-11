# Deployment Quickstart

## Vercel (frontend)
1. Push repo to GitHub.
2. On Vercel, New Project -> Import GitHub repo.
3. In Project Settings set Root Directory to `frontend`.
4. Build Command: `npm run build` ; Output Directory: `build`
5. Add env vars: REACT_APP_API_URL and REACT_APP_WS_URL
6. Deploy.

## Railway (backend + websocket)
1. Create a new Railway project.
2. Add a service -> Deploy from GitHub -> select `backend` folder.
   - Start command: `node server.js`
3. Repeat: Add service for `websocket` folder.
   - Start command: `node websocket-server.js`
4. Add MongoDB plugin or configure MONGODB_URI.
5. Set environment variables (MONGODB_URI, QIE_RPC_URL, EXECUTOR_PRIVATE_KEY, etc).
6. Deploy.

## Docker (self-hosted)
1. Copy .env.example -> .env and fill values.
2. docker-compose up -d --build
