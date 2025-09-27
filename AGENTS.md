# Repository Guidelines

This repository contains a lightweight web frontend for a bingo terminal along with a small Python backend used for local development and data relays. Keep changes small, testable, and focused.

## Project Structure & Module Organization
- Root frontend: `index.html`, `script.js`, `mobile.css`, `config.js`
- Assets: `fundos/` (images/gifs), `mp3/` (audio)
- Dev servers: `server.py` (API/WS), `frontend_server_celular.py` (static server)
- Builds/backups: `build/`, `dist/`, `BkUp/`, and several `OK*` example snapshots (do not modify without need)

## Build, Test, and Development Commands
- Run frontend (static): `python3 frontend_server_celular.py` (serves on `http://localhost:8000`)
- Run backend API/WS: `python3 server.py` (defaults to port `3001`)
- Python deps (no requirements.txt):
  - `pip install flask flask-cors gevent gevent-websocket pymongo`
- Optional PyInstaller builds: `pyinstaller ServerFront.spec` or `pyinstaller BackEndCelular.spec`

Tip: For local dev, set `API_BASE_URL` and `WS_URL` in `config.js` to `http://localhost:3001` and `ws://localhost:3001`.

## Coding Style & Naming Conventions
- JavaScript: 4‑space indent, camelCase for variables/IDs (Portuguese labels are common).
- HTML: Tailwind via CDN; prefer semantic tags and utility classes over custom CSS (use `mobile.css` only when needed).
- Python: Follow PEP8 where practical; keep handlers small and side‑effect free.
- Filenames: lowercase with dashes or underscores; keep variants together (e.g., `mobile-*.js`, `*-server.py`).

## Testing Guidelines
- No automated tests yet. Validate manually:
  - Load `http://localhost:8000`, confirm grids, prizes, and last balls render.
  - Confirm WebSocket updates and API responses at `http://localhost:3001/api/initial-data`.
  - Exercise mobile and desktop layouts.

## Commit & Pull Request Guidelines
- Commits: concise, imperative, scoped messages (Portuguese or English). Example: `feat(ui): exibe números faltantes` or `fix(api): corrige range de cartelas`.
- PRs: clear description, linked issues, before/after screenshots or short clip, test notes, and rollout considerations. Limit PRs to one logical change.

## Security & Configuration Tips
- Do not commit real credentials. Move `MONGO_URI` and ports to environment variables when possible.
- Keep `config.js` IPs local during development; avoid hard‑coding production endpoints.
- Large binaries under `dist/` and `build/` should not be edited; regenerate instead.

