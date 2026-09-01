# Research: Codex Fast mode wire semantics

Date: 2026-08-31
Status: verified against first-party API docs, official Codex source, and the published plugin artifact

Question: does this plugin distinguish normal and Fast Codex rows correctly, and does a normal response around 70+ output tokens/s imply that Fast was used?

Short answer: **the wire mapping is correct**. Fast requests use `service_tier: "priority"`; normal requests omit `service_tier`, matching the official Codex client's standard-routing behavior. A TPS value alone cannot prove which tier served a request.

## First-party semantics

OpenAI's [Responses API reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) states:

- request-level Fast mode accepts `service_tier=fast` or `service_tier=priority`;
- a Fast response reports `service_tier=priority`;
- `default` is standard pricing and performance;
- an omitted tier behaves as `auto` (normally `default` unless the project is configured otherwise);
- when a tier is requested, the returned `service_tier` is the processing mode actually used and may differ from the requested value.

The official Codex implementation makes the product mapping explicit:

- [`ServiceTier::Fast.request_value()` returns `"priority"`](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/config_types.rs).
- [`ModelInfo::service_tier_for_request`](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/openai_models.rs) removes the explicit `default` sentinel and only forwards a supported accelerated tier. Therefore normal Codex turns omit the field on the wire rather than sending `service_tier: "default"`.
- The official [Codex model catalog](https://github.com/openai/codex/blob/main/codex-rs/models-manager/models.json) describes the `priority` tier as “Fast” and as a relative speed increase, not a fixed TPS threshold.

## Plugin verification

The checked production profile uses published `dsh-llm-codex` v0.3.6. A local loopback capture drove its real bundled `codexResponsesApi().stream` path without contacting ChatGPT and observed:

| Picker row | Wire model | Wire service tier |
|---|---|---|
| `gpt-5.6-terra` | `gpt-5.6-terra` | omitted |
| `gpt-5.6-terra-fast` | `gpt-5.6-terra` | `priority` |

Focused source tests also passed: 13/13 assertions across `tests/service-tier.spec.ts` and `tests/catalog.spec.ts`.

## Interpretation of 70+ TPS

A normal turn reaching 70+ TPS is not evidence that it was sent as Fast:

1. OpenAI defines Fast as a service tier / relative acceleration, not “TPS above N”.
2. Absolute throughput varies with model, load, transport, output shape, and measurement window.
3. The authoritative signal is the response's resolved `service_tier`, not client-side TPS.

The plugin currently guarantees that only `-fast` picker IDs request `priority`. It does not currently surface the server-resolved response tier beside the TPS metric. Adding that observability would distinguish “requested Fast”, “served Fast”, and “normal happened to be fast” without relying on throughput inference.
