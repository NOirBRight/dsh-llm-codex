# Changelog

## 0.1.0

Initial ChatGPT Codex provider for DeepSeek Harness.

- Provider route `codex`, settings namespace `llm-codex`, Host credentials at `$DSH_HOME/codex-oauth.json` (`0600`)
- Connect-style ChatGPT OAuth popup; no API key and no `~/.codex/auth.json`
- Default picker: Sol / Terra / Luna × normal + Fast; Fast is a separate row that sends `service_tier: "priority"`
- Grok-style collapsed catalog and per-row details; Fast is not a checkbox
- Optional Codex search provider (default off), official non-Fast model dropdown, default search model `gpt-5.6-luna`
- Optional `view_image` tool (default off) for local files and public HTTP(S), including Clash fake-IP DNS
- Does not write `web.searchProvider` or `agent-default-model`
- Auth HTTP replies are decoded in `client-contract.ts` and reject token-shaped fields
- README includes catalog and optional-capabilities screenshots
