# ig-templates-demo

Puppeteer-based renderer used by the "IG Content Builder" n8n workflow's `Execute Command: Build & Render` node. Takes a slide plan JSON and renders each slide's HTML template to a PNG via headless Chromium.

## What's included

Only the files needed at runtime:

- `scripts/build-and-render-demo.mjs` — entry point, invoked as `node scripts/build-and-render-demo.mjs --mp-id=<id>`
- `lib/render-image-validation.cjs` — image URL validation helper
- `templates/*.html` — slide templates (self-contained, inline `<style>`, no external CSS)
- `package.json` / `package-lock.json`

All paths in `build-and-render-demo.mjs` are resolved relative to the script's own location (`ROOT = join(__dirname, '..')`), so this folder works from any install path — no hardcoded paths to edit.

## Not included (intentionally)

- `node_modules/` — run `npm install` after deploying
- Design/output scratch folders (`Template_design/`, `Demo render/`, `renders/`, `chroma_db/`, `.venv-rag/`) and unrelated documents/notebooks that lived alongside this project on the original machine
- `config/telegram.json` from the original folder — contained a live Telegram bot token and a MiniMax API key; it isn't read by anything in this runtime path, so it was dropped rather than sanitized
- Dev/test/one-off scripts (`_test_*.mjs`, `apply-phase*-fixes.mjs`, `patch-code-*.mjs`, `fix-parse-plan-inline.mjs`, `preview-code-intro-news-style.mjs`, `render.mjs`, `build-and-render.mjs`) — not called by the deployed n8n workflow

## Known gap

Two templates (`news-content-closing.html`, `news-content-isi.html`) hard-code an `<img>` src pointing at a local avatar file (`D:/Agent_workspace/ig-templates/renders/satrya/avatar.png`) instead of using the `{{AVATAR_URL}}` placeholder the other templates use. The avatar just won't render until this is fixed and a real avatar URL is supplied.

## Deploy

Puppeteer needs a system Chromium on the host (see the n8n Dockerfile — `PUPPETEER_SKIP_DOWNLOAD` + `PUPPETEER_EXECUTABLE_PATH`). After `npm install`, the n8n workflow's `Execute Command: Build & Render` node must call this script with the full path to wherever this folder is deployed, e.g.:

```
node /home/node/ig-templates-demo/scripts/build-and-render-demo.mjs --mp-id=...
```
