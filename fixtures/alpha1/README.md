# Alpha.1 fixture provenance

Every archive in [tarballs](./tarballs) is a repository-owned input. [PROVENANCE.json](./PROVENANCE.json) records its package@version identity, byte count, SHA-256, and every recorded parent dependency edge. Distinct versions of one package are valid; duplicate package@version archives and duplicate tar members are not.

The DSH archives were packed from the read-only clean alpha.1 checkout. The exact runtime third-party closure includes @earendil-works/pi-ai@0.84.2 and openai@6.40.0. The dsh-model-switch fixture is used only for the temporary development/install closure. The LLM Providers UI owner is intentionally not copied into this repository; the gate accepts it only through DSH_PROVIDERS_UI_ARTIFACT and DSH_PROVIDERS_UI_SHA256.

## Regenerate

1. Build and pack the DSH workspaces from the read-only clean checkout with its pinned package manager; do not edit manifests or add source files.
2. Pack the exact third-party versions required by the runtime closure.
3. Replace the matching archives, then regenerate all records and parent edges in PROVENANCE.json.
4. Run pnpm run pack:check with the validated owner artifact environment.

Known missing public export targets in upstream archives are listed explicitly in PROVENANCE.json. The pack gate rejects every unlisted missing target and every target used by the plugin or its installed runtime closure.
