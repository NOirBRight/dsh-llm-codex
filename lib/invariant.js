//#region lib/types/invariant.js
/**
* Package-owned invariant companion for `dsh-llm-codex`.
* @module dsh-llm-codex/invariant
*/
const PACKAGE_NAME = "dsh-llm-codex";
const name = "llm-codex-invariant";
const inject = ["invariants"];
const install = () => {};
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
