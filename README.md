# IG Content Builder — n8n Workflow

Export of the "ig Content Builder For Demo" n8n workflow (source id `V8VbQm1KWpe7jj7Y`), for deployment to the production n8n instance on EC2 (`n8n.satryapudja.site`).

## Import

Import `ig_content_builder_workflow_n8n.json` into n8n, keep it **inactive** until credentials are reconnected and a test run passes.

## Credentials to recreate after import

None of the credentials are embedded in this file — reconnect all of the following in the n8n editor after import:

- **HTTP Header Auth** — `OpenRouter Authorization - IG Content Builder` (nodes: `AI Research (MiMo)`, `AI Planner (MiMo)`)
- **HTTP Header Auth** — `KobiLLM Authorization - IG Content Builder` (nodes: `AI Brief Generator (MiMo)`, `AI Caption Generator`)
- **Google Sheets OAuth2** (nodes: `Load Plan from Sheets`, `Log to Content Log (Sheets)`, `Load Content History`, `Google Sheets: Claim Content Plan Slot`, `Google Sheets: Mark Content Plan Success`, `Google Sheets: Mark Content Plan Failed`)
- **Telegram Bot** (nodes: `Telegram - Morning Brief`, `Telegram - Send Result`, `Telegram - Send Operational Alert`, `Telegram - Send Demo Error Alert`)
- **Gmail OAuth2** (nodes: `Send Result Email`, `Send Error Email`)

Actual key/token values are not stored in this repo. See the owner's local credential notes.
