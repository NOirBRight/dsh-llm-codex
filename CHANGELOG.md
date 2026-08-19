# Changelog

## 0.2.3

- Retry model requests up to eight times by default; provider configuration can override the budget
- Classify retry-safe abnormal ChatGPT WebSocket closures and overload responses as `TRANSPORT` or `SERVER`; keep message-too-large 1009 and ambiguous usage limits non-retryable

## 0.2.2

- Show official reset time under each Codex window (`reset_at` / `reset_after_seconds`)
- Rename Settings nav/title from Providers to LLM Providers / LLM 供应商

## 0.2.1

- Cancel an abandoned ChatGPT browser login from the Providers card so closing the window mid-auth no longer leaves the Host stuck on “waiting for browser sign-in”
- Open ChatGPT sign-in in the system browser (xdg-open), like Cursor and Grok, instead of a Lab-owned popup

## 0.2.0

- Move the settings card from Plugins to Settings → Providers
- The Providers nav row is claimed by the first installed provider plugin and disappears when all of them are uninstalled
- Collapsed cards show a short connection status and model count, not the account email
- Usage refresh shows a skeleton, a spinning official refresh glyph, a failure hint next to the button, and a last-updated clock

## 0.1.2

- Official 5.6 picker can add first-class 1M rows (`gpt-5.6-sol-1m`, `…-1m-fast`); default catalog stays the six 272k rows
- Per-row Default thinking and Context window; Tools checkbox removed (it never changed requests)
- 1M rows set `contextWindow` to 1,000,000; DSH compaction still uses its default 80% threshold

## 0.1.1

- Set model defaults: Luna `max`, Terra `xhigh`, Sol `high`, all other official models `xhigh`; Fast rows inherit their base model

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
