# dsh-llm-codex

English | [中文](README.zh.md)

ChatGPT Codex integration for DeepSeek Harness. This plugin is a separate provider route (`codex`) and settings namespace (`llm-codex`). It does not declare `apiKeyEnv`, does not read or write `~/.codex/auth.json`, and does not share a credential file with `dsh-codex-connect`.

The package root exposes the Cordis plugin contract. The same artifact exports `./client`, which contributes the Codex card under Settings → LLM Providers.

## Compatibility

Verified runtimes are DeepSeek Harness `0.1.2-alpha.4` and `0.1.2-rc.1` on Cordis `4.0.2`; this record is evidence, not an allowlist.

Unknown newer runtimes are attempted on a best-effort basis after one warning, and the plugin keeps its normal mount path.

A reproduced failure is blocklisted only afterward; see the [compatibility records](package.json) for the affected version, reason, and evidence.


## Installation

Install directly from GitHub:

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.1.5/dsh-llm-providers-ui-0.1.5.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/download/v0.3.13/dsh-llm-codex-0.3.13.tgz
dsh web
~~~

The repository tracks release-ready lib artifacts, so GitHub installation needs no build-script allowlist. A source checkout can use a link installation after running `pnpm run build`.

## Management RPC

The settings and authentication RPC uses Connection's authenticated `/codex` channel. Host trusted-host and Origin policy controls remote access; this plugin has no separate remote-management switch.

## Web configuration

Open Settings → LLM Providers → Codex. **Sign in with ChatGPT** starts the official ChatGPT OAuth flow, opens the system browser, and stores the session only on the Host at `$DSH_HOME/codex-oauth.json` (mode `0600`). The card then shows usage limits. Sign out deletes that file. The browser never receives tokens.

![Codex plugin card: ChatGPT login, usage, and Fast catalog rows](docs/images/plugin-card-catalog.png)

### Model catalog

The conversation picker uses the displayed catalog stored as `settings.models`. The default is six rows:

- `gpt-5.6-sol` / `gpt-5.6-sol-fast`
- `gpt-5.6-terra` / `gpt-5.6-terra-fast`
- `gpt-5.6-luna` / `gpt-5.6-luna-fast`

Fast and 1M are first-class picker rows, not checkboxes. Chat still uses the official wire id; Fast rows send `service_tier: "priority"`. 1M rows (`gpt-5.6-sol-1m`, `gpt-5.6-sol-1m-fast`, and the Terra/Luna equivalents) set `contextWindow` to 1,000,000 so DSH compaction waits until 80% of that budget (800k). They are not in the default six-row catalog; add them from the official picker. The overlay can also add `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex-spark`, and Fast variants. Custom ids can be added manually.

Picker ids may also use a generic context suffix `-<n>k` or `-<n>m` (for example `gpt-5.6-sol-272k` or `gpt-5.6-sol-272k-fast`). The plugin peels that suffix before talking to ChatGPT and uses `n×1000` / `n×1,000,000` as the DSH compaction budget, so a 272K row starts compacting earlier than a 1M row. Product names such as `kimi-k3-max` are not treated as a context tier. The composer picker groups sibling rows that share a base id.

Default reasoning effort is per model and editable on the row: Luna uses `max`, Terra `xhigh`, Sol `high`, and every other official Codex model `xhigh`. Fast and 1M rows use their base model's default. A reasoning effort explicitly selected in a conversation takes precedence.

Chat goes through pi-ai `openai-codex-responses` against `https://chatgpt.com/backend-api`. Chat without a session fails `MISSING_CREDENTIAL`. A stored session whose refresh fails is reported as `AUTH`. A later content-less `AUTH` (HTTP 401) force-refreshes the session and retries the request once; remaining `AUTH` failures are eligible for the bundle's eight normal retries.

### Model Switch integration

When `dsh-model-switch` v0.2+ is present, Codex registers optional Search and Image adapters that reuse this plugin's authenticated clients. Model Switch keeps official `web_search` ownership and leaves `view_image` / `codex_generate_image` unchanged. No Vision adapter is registered.

### Optional capabilities

Search, `view_image`, and `codex_generate_image` are implemented but default off. Enabling any of them and clicking Save registers or unregisters it immediately; no restart is required. Search registers a standalone Codex `WebSearchProvider` (`POST /codex/alpha/search`). It does **not** write `web.searchProvider` or `agent-default-model`. The search-model dropdown lists official non-Fast models and defaults to `gpt-5.6-luna`. The plugin also registers `web/openai-codex-search-llm-request` so session logs written by `dsh-codex-connect` remain readable after that plugin is uninstalled. Search modes match official Codex:

- `cached` (default): OpenAI-maintained index, no live fetch
- `indexed`: live fetch only when the search index gates the request
- `live`: unrestricted live retrieval

`view_image` is a model-invoked tool for local files and public-network HTTP(S) images. Spark is text-only.

`codex_generate_image` is a separate model-invoked tool. Any conversation model can call it; it uses this plugin's ChatGPT login and Codex usage (typically 3–5× a text turn) and draws with backend `gpt-image-2`. The routing-model dropdown lists official vision models and defaults to `gpt-5.6-luna`. The name is intentionally not `generate_image`, so it does not collide with other provider plugins. Generated files land under `generated-images/` unless `path` is set.

![Optional Codex search and view_image capabilities](docs/images/plugin-card-capabilities.png)

![Optional Codex search and view_image capabilities](docs/images/plugin-card-capabilities.png)

## Config

~~~yaml
- id: llm-codex
  name: 'dsh-llm-codex'
  config:
    enableSearch: false
    enableImageTool: false
    enableImageGeneration: false
    streamIdleTimeoutMs: 300000
    retryPolicy:
      mode: normal
      maxRetries: 8
      backoff:
        initialDelayMs: 500
        maxDelayMs: 10000
        jitterRatio: 0.1
~~~

The bundle retries eligible model-request failures up to eight times by default, including `AUTH`. ChatGPT WebSocket closures, including code-and-reason variants other than message-too-large code 1009, connection limits, and overload responses use retryable DSH failure codes. Ambiguous usage limits remain non-retryable.

There is no `apiKeyEnv` and no user-editable base URL. `models` is the displayed conversation catalog.

## LLM Providers UI ownership

The **LLM Providers** Settings page (`settings.section` `id: providers` with child `settings.provider.item`) and the shared `llm-providers` order store are owned solely by `dsh-llm-providers-ui`.

- This plugin contributes only its keyed card (`key: llm-codex`) and its Host ``llm`` route; it does not install the page or the shared `llm-providers` namespace. Load order with the owner does not matter.
- Without the owner (Headless or Web without `dsh-llm-providers-ui`): the Host model route `codex` still works; in Web the owner controls whether the Providers page and this card are mounted. A Web release composition test rejects a bundle graph that ships provider cards without the owner.
- The nav globe glyph is a temporary Alpha.4 DOM adapter owned only by `dsh-llm-providers-ui` (`src/client/nav-icon.ts`); this plugin does not ship that adapter.

Install `dsh-llm-providers-ui` explicitly in the profile alongside provider plugins (see that package's `cordis.patch.yml`).

## License

MIT

## Release installation (Latest)

ChatGPT Codex login, model catalog, usage, and optional search/image capabilities. The release artifact targets DeepSeek Harness 0.1.2-alpha.4 and contains built Host/Client files only; it has no sibling-repository source, workstation path, link:, or workspace: dependency.

The dsh-llm-providers-ui package owns the LLM Providers page, navigation, and shared order store. This package owns only its provider card, models, credentials, and Host route. Install the Owner first for Web; headless Host routing works without the Owner.

Owner (Latest):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.1.5.tgz
~~~

Provider (Latest):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/latest/download/dsh-llm-codex-0.3.13.tgz
~~~

Fixed versions (reproducible):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.1.5/dsh-llm-providers-ui-0.1.5.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/download/v0.3.13/dsh-llm-codex-0.3.13.tgz
~~~

Update, uninstall, and verify:

~~~sh
# Update to the latest Release
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/latest/download/dsh-llm-codex-0.3.13.tgz
# Verify the loaded version
dsh plugin --profile web list
dsh plugin --profile web doctor
# Uninstall only this plugin
dsh plugin --profile web remove dsh-llm-codex
~~~

Configuration: use the plugin section in Settings for Web UI plugins, or the profile dsh.profile.bundles entry for Host-only plugins. Start with this README's minimal YAML/JSON example and provide credentials/backend addresses explicitly.

Rollback: rerun the fixed v0.3.7 command, verify the profile list, then restart the Web service once. Inspect journalctl --user -u dsh-web.service and dsh plugin --profile web doctor; never put a source checkout in the production profile.

Release and integrity: [v0.3.13](https://github.com/NOirBRight/dsh-llm-codex/releases/tag/v0.3.13) · [SHA256SUMS](https://github.com/NOirBRight/dsh-llm-codex/releases/download/v0.3.13/SHA256SUMS).

## Independent Model Switch search (unreleased integration)

The Host adapter self-declares its current search model catalog (`tools !== false`) through the existing Model Switch adapter registry. Search uses the existing ChatGPT credential store and Codex search implementation; no credentials or executable functions are sent to the browser. Model declarations follow current provider settings. Unsupported models and missing credentials fail explicitly.

This requires the coordinated Model Switch dynamic-search implementation, not merely adding a provider label to an older release. Registration does not select global Web routing: explicitly configure `web.searchProvider: model-switch` while preserving the complete existing Web config, then select the adapter/model in Model Switch Settings. `web_fetch` is unchanged. ProviderDirectory role/usage registration remains deferred through `ctx.inject`.

Validation: `pnpm test` (142 passed, 1 skipped), `pnpm run build`; live acceptance through 3082 official Web selection succeeded with `gpt-5.6-luna`. See the Model Switch integration audit for exact lab composition and evidence.
