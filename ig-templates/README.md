# ig-templates

Used by the "IG Content Builder" n8n workflow's `Execute Command: Resolve Images` node to resolve/validate image candidates for a content plan against a brand-asset map. Pure Node.js, no browser/Puppeteer needed here.

## What's included

- `scripts/resolve-images.mjs` — entry point, invoked as `node scripts/resolve-images.mjs --mp-id=<id>`
- `lib/image-resolver.cjs` — resolution logic
- `config/brand-assets.json` — brand name → logo URL map (no secrets)
- `package.json` / `package-lock.json`

All paths in `resolve-images.mjs` already resolve relative to the script's own location (`ROOT = join(__dirname, '..')`) — nothing to edit after deploying to a new path.

## Not included (intentionally)

- `node_modules/` — run `npm install` after deploying
- `renders/` (168 MB of generated PNGs) and `content-plans/` — runtime input/output, not source
- `config/telegram.json` — contained a live Telegram bot token and a MiniMax API key, not read by `resolve-images.mjs` or `image-resolver.cjs`, dropped rather than sanitized
- `config/active_wait.json` — stale local runtime state (a `localhost:5678` webhook resume URL), not needed
- `.workflow/ig-impl.js` — an internal build log that also contained a hardcoded MiniMax key; unrelated to running the workflow
- Dev/test/one-off scripts and the `skills/`, `ai_docs/`, `tests/` folders from the original project

## Deploy

After `npm install`, the n8n workflow's `Execute Command: Resolve Images` node must call this script with the full path to wherever this folder is deployed, e.g.:

```
node /home/node/ig-templates/scripts/resolve-images.mjs --mp-id=...
```
