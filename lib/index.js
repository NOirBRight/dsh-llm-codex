import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import { LlmAdapter, LlmError, ReasoningEffortId, RetryPolicySchema, createUserMessage, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { deepEqualJson } from "@deepseek-ai/dsh-util-values";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { createModels, createProvider } from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { openAICodexResponsesApi } from "@earendil-works/pi-ai/api/openai-codex-responses.lazy";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { AttachmentId } from "@deepseek-ai/dsh-attachment";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { WebError } from "@deepseek-ai/dsh-web";
import { lookup } from "node:dns/promises";
import { request } from "node:http";
import { request as request$1 } from "node:https";
import { BlockList, isIP } from "node:net";
//#region lib/types/compatibility.js
/**
* Classify one runtime without treating the verified table as an allowlist.
* @param version - Resolved DSH runtime version.
* @param verified - Releases with direct compatibility evidence.
* @param blocklist - Versions excluded after reproduced failures.
* @returns The fail-open mount decision.
*/
function classifyDshRuntime(version, verified, blocklist = {}) {
	const reason = blocklist[version];
	if (typeof reason === "string" && reason.trim() !== "") return {
		kind: "blocked",
		reason
	};
	return verified.has(version) ? { kind: "verified" } : { kind: "unverified" };
}
/**
* Apply the fail-open decision and emit at most one visible warning.
* @param logger - Host logger receiving compatibility warnings.
* @param pluginName - Plugin identifier used in diagnostics.
* @param version - Resolved DSH runtime version.
* @param verified - Releases with direct compatibility evidence.
* @param blocklist - Versions excluded after reproduced failures.
* @returns Whether the host mount should continue.
*/
function shouldMountDshRuntime(logger, pluginName, version, verified, blocklist = {}) {
	const decision = classifyDshRuntime(version, verified, blocklist);
	if (decision.kind === "blocked") {
		logger.warn(`[${pluginName}] blocked on DSH ${version}: ${decision.reason}; see package.json#dsh.compatibility.blocklist`);
		return false;
	}
	if (decision.kind === "unverified") logger.warn(`[${pluginName}] best-effort on unverified runtime ${version}`);
	return true;
}
function readManifest() {
	try {
		return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	} catch {
		return {};
	}
}
function packageVersion(packageName) {
	try {
		const require = createRequire(import.meta.url);
		let directory = dirname(require.resolve(packageName));
		for (;;) {
			try {
				const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
				if (typeof manifest.version === "string" && manifest.version !== "") return manifest.version;
			} catch {}
			const parent = dirname(directory);
			if (parent === directory) return void 0;
			directory = parent;
		}
	} catch {
		return;
	}
}
/**
* Warn once for an unknown runtime while keeping the normal host mount path.
* @param logger - Host logger receiving compatibility warnings.
* @param pluginName - Plugin identifier used in diagnostics.
* @param candidates - DSH peer packages used to resolve the host version.
* @returns Whether the host mount should continue.
*/
function allowDshRuntime(logger, pluginName, candidates) {
	const version = process.env.DSH_VERSION?.trim() || candidates.map(packageVersion).find((value) => value !== void 0) || "unknown";
	const compatibility = readManifest().dsh?.compatibility;
	return shouldMountDshRuntime(logger, pluginName, version, new Set(Object.entries(compatibility?.dshReleases ?? {}).filter(([, status]) => status === "compatible" || status === "verified").map(([release]) => release)), compatibility?.blocklist);
}
//#endregion
//#region lib/types/catalog.js
/**
* Official Codex catalog plus first-class Fast and 1M rows.
* Display ids are picker keys; wire ids are what ChatGPT receives.
*/
/** Suffix that marks a first-class Fast picker row. */
const CODEX_FAST_SUFFIX = "-fast";
/** Suffix that marks a first-class 1M context picker row. */
const CODEX_LARGE_CONTEXT_SUFFIX = "-1m";
/** Official Fast service tier sent on the wire. */
const CODEX_FAST_SERVICE_TIER = "priority";
/** Documented 1M context budget for official 5.6 large rows. */
const CODEX_LARGE_CONTEXT_WINDOW = 1e6;
/** Peel a trailing `-<n>k` / `-<n>m` context tier. Product names like `-max` stay. */
function peelContextSuffix(id) {
	const match = /-(\d+)(k|m)$/iu.exec(id);
	if (match === null || match.index === 0) return { base: id };
	const n = Number(match[1]);
	const unit = match[2].toLowerCase();
	return {
		base: id.slice(0, match.index),
		tokens: unit === "m" ? n * 1e6 : n * 1e3
	};
}
const LEVELS_56 = Object.freeze({
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max",
	ultra: "ultra",
	minimal: "low"
});
const LEVELS_DEFAULT = Object.freeze({
	xhigh: "xhigh",
	high: "high",
	minimal: "low"
});
/** Official Codex models, in picker order. 1M rows are opt-in for the 5.6 family. */
const CODEX_OFFICIAL_MODELS = Object.freeze([
	Object.freeze({
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol",
		vision: true,
		thinking: true,
		tools: true,
		contextWindow: 272e3,
		maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
		maxTokens: 128e3,
		fast: true,
		largeContext: true,
		thinkingLevelMap: LEVELS_56
	}),
	Object.freeze({
		id: "gpt-5.6-terra",
		name: "GPT-5.6 Terra",
		vision: true,
		thinking: true,
		tools: true,
		contextWindow: 272e3,
		maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
		maxTokens: 128e3,
		fast: true,
		largeContext: true,
		thinkingLevelMap: LEVELS_56
	}),
	Object.freeze({
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		vision: true,
		thinking: true,
		tools: true,
		contextWindow: 272e3,
		maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
		maxTokens: 128e3,
		fast: true,
		largeContext: true,
		thinkingLevelMap: LEVELS_56
	}),
	Object.freeze({
		id: "gpt-5.5",
		name: "GPT-5.5",
		vision: true,
		thinking: true,
		tools: true,
		contextWindow: 272e3,
		maxContextWindow: 272e3,
		maxTokens: 128e3,
		fast: true,
		largeContext: false,
		thinkingLevelMap: LEVELS_DEFAULT
	}),
	Object.freeze({
		id: "gpt-5.4",
		name: "GPT-5.4",
		vision: true,
		thinking: true,
		tools: true,
		contextWindow: 272e3,
		maxContextWindow: CODEX_LARGE_CONTEXT_WINDOW,
		maxTokens: 128e3,
		fast: true,
		largeContext: false,
		thinkingLevelMap: LEVELS_DEFAULT
	}),
	Object.freeze({
		id: "gpt-5.4-mini",
		name: "GPT-5.4 mini",
		vision: true,
		thinking: true,
		tools: true,
		contextWindow: 272e3,
		maxContextWindow: 272e3,
		maxTokens: 128e3,
		fast: false,
		largeContext: false,
		thinkingLevelMap: LEVELS_DEFAULT
	}),
	Object.freeze({
		id: "gpt-5.3-codex-spark",
		name: "GPT-5.3 Codex Spark",
		vision: false,
		thinking: true,
		tools: true,
		contextWindow: 128e3,
		maxContextWindow: 128e3,
		maxTokens: 128e3,
		fast: false,
		largeContext: false,
		thinkingLevelMap: LEVELS_DEFAULT
	})
]);
/** Default conversation-picker rows: Sol / Terra / Luna x normal + Fast. */
const CODEX_DEFAULT_MODEL_IDS = Object.freeze([
	"gpt-5.6-sol",
	"gpt-5.6-sol-fast",
	"gpt-5.6-terra",
	"gpt-5.6-terra-fast",
	"gpt-5.6-luna",
	"gpt-5.6-luna-fast"
]);
Object.freeze({
	minimal: "Minimal",
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "Extra high",
	max: "Max",
	ultra: "Ultra"
});
function officialByWireId(id) {
	return CODEX_OFFICIAL_MODELS.find((model) => model.id === id);
}
/**
* Split a picker id into the ChatGPT wire id plus Fast / context flags.
* Generic `-<n>k` / `-<n>m` rows (including `-1m`) peel to the wire id and
* carry a compaction budget. Product names such as `-max` are not peeled.
*/
function parseCodexPickerId(id) {
	let rest = id;
	let fast = false;
	if (rest.endsWith("-fast") && rest.length > 5) {
		rest = rest.slice(0, -5);
		fast = true;
	}
	const tier = peelContextSuffix(rest);
	rest = tier.base;
	const official = officialByWireId(rest);
	const largeContext = tier.tokens === CODEX_LARGE_CONTEXT_WINDOW;
	return {
		wireId: official?.id ?? rest,
		fast,
		largeContext,
		...tier.tokens === void 0 ? {} : { contextTokens: tier.tokens }
	};
}
function variantName(official, variant) {
	return [
		official.name,
		...variant.largeContext ? ["1M"] : [],
		...variant.fast ? ["Fast"] : []
	].join(" ");
}
function variantId(official, variant) {
	return official.id + (variant.largeContext ? "-1m" : "") + (variant.fast ? CODEX_FAST_SUFFIX : "");
}
function rowOf(official, variant) {
	return {
		id: variantId(official, variant),
		name: variantName(official, variant),
		thinking: official.thinking,
		vision: official.vision,
		tools: official.tools,
		contextWindow: variant.largeContext ? CODEX_LARGE_CONTEXT_WINDOW : official.contextWindow,
		maxTokens: official.maxTokens,
		...variant.fast ? { fast: true } : {}
	};
}
/** Official catalog plus Fast and 1M rows where the model advertises them. */
function officialPickerCatalog() {
	const rows = [];
	for (const model of CODEX_OFFICIAL_MODELS) {
		rows.push(rowOf(model, {
			fast: false,
			largeContext: false
		}));
		if (model.fast) rows.push(rowOf(model, {
			fast: true,
			largeContext: false
		}));
		if (model.largeContext) {
			rows.push(rowOf(model, {
				fast: false,
				largeContext: true
			}));
			if (model.fast) rows.push(rowOf(model, {
				fast: true,
				largeContext: true
			}));
		}
	}
	return rows;
}
/** Frozen default displayed subset. */
function defaultDisplayedCatalog() {
	const allowed = new Set(CODEX_DEFAULT_MODEL_IDS);
	return officialPickerCatalog().filter((model) => allowed.has(model.id));
}
/** Look up the official model that backs a picker id, if any. */
function officialModelFor(id) {
	return officialByWireId(parseCodexPickerId(id).wireId);
}
/** Official non-Fast wire ids that accept image input, used as generate_image routers. */
function officialImageGenerationModels() {
	return CODEX_OFFICIAL_MODELS.filter((model) => model.vision);
}
/** Default reasoning effort for a displayed row. Fast / 1M rows share the base policy. */
function defaultCodexReasoningEffort(id) {
	switch (officialModelFor(id)?.id) {
		case "gpt-5.6-luna": return "max";
		case "gpt-5.6-terra": return "xhigh";
		case "gpt-5.6-sol": return "high";
		default: return "xhigh";
	}
}
/** Map a displayed catalog id onto the ChatGPT request. */
function resolveWireModel(id) {
	const parsed = parseCodexPickerId(id);
	return {
		wireId: parsed.wireId,
		...parsed.fast ? { serviceTier: CODEX_FAST_SERVICE_TIER } : {}
	};
}
/** Merge a user-edited row with official metadata when the id is known. */
function hydrateCatalogModel(model) {
	const parsed = parseCodexPickerId(model.id);
	const official = officialByWireId(parsed.wireId);
	const fast = parsed.fast && (official === void 0 || official.fast === true);
	const largeContext = parsed.largeContext && official?.largeContext === true;
	const impliedWindow = parsed.contextTokens ?? (largeContext ? 1e6 : void 0);
	const contextWindow = model.contextWindow ?? impliedWindow;
	if (official === void 0) return {
		id: model.id,
		...model.name === void 0 ? {} : { name: model.name },
		...model.description === void 0 ? {} : { description: model.description },
		...contextWindow === void 0 ? {} : { contextWindow },
		...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens },
		...model.thinking === void 0 ? {} : { thinking: model.thinking },
		...model.defaultEffort === void 0 ? {} : { defaultEffort: model.defaultEffort },
		...model.efforts === void 0 ? {} : { efforts: model.efforts },
		...model.vision === void 0 ? {} : { vision: model.vision },
		...model.tools === void 0 ? {} : { tools: model.tools },
		...fast ? { fast: true } : {}
	};
	return {
		id: model.id,
		name: model.name ?? variantName(official, {
			fast,
			largeContext
		}),
		thinking: model.thinking ?? official.thinking,
		vision: model.vision ?? official.vision,
		tools: model.tools ?? official.tools,
		contextWindow: model.contextWindow ?? impliedWindow ?? official.contextWindow,
		maxTokens: model.maxTokens ?? official.maxTokens,
		...fast ? { fast: true } : {},
		...model.defaultEffort === void 0 ? {} : { defaultEffort: model.defaultEffort },
		...model.efforts === void 0 ? {} : { efforts: model.efforts },
		...model.description === void 0 ? {} : { description: model.description }
	};
}
//#endregion
//#region lib/types/client-contract.js
/** Browser-safe constants and JSON decoders shared by Host and client faces. */
/** Settings namespace owned by this plugin. */
const CODEX_SETTINGS_NAMESPACE = "llm-codex";
/** Public DSH provider route. Distinct from pi-ai's internal `openai-codex` id. */
const CODEX_PROVIDER = "codex";
/** Default maximum idle interval while a stream read is outstanding. */
const CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
/** Private Connection RPC channel used for catalog save. */
const CODEX_RPC_CHANNEL = "/codex";
/** Atomic settings-save endpoint. */
const CODEX_SAVE_ENDPOINT = "settings/save";
/** Authoritative settings snapshot endpoint. */
const CODEX_SETTINGS_READ_ENDPOINT = "settings/read";
/** Authenticated remote model refresh endpoint. */
const CODEX_MODELS_FETCH_ENDPOINT = "models/fetch";
const CODEX_AUTH_STATUS_ENDPOINT = "auth/status";
const CODEX_AUTH_BEGIN_ENDPOINT = "auth/begin";
const CODEX_AUTH_CANCEL_ENDPOINT = "auth/cancel";
const CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT = "auth/attempt-status";
const CODEX_AUTH_LOGOUT_ENDPOINT = "auth/logout";
/** Plugin-owned status endpoint consumed by its browser half. */
const CODEX_AUTH_STATUS_PATH = "/plugins/dsh-llm-codex/auth/status";
/** Plugin-owned browser-login endpoint consumed by its browser half. */
const CODEX_AUTH_LOGIN_PATH = "/plugins/dsh-llm-codex/auth/login";
/** Plugin-owned logout endpoint consumed by its browser half. */
const CODEX_AUTH_LOGOUT_PATH = "/plugins/dsh-llm-codex/auth/logout";
/** Default model used by the standalone search endpoint. */
const DEFAULT_CODEX_SEARCH_MODEL = "gpt-5.6-luna";
/** Default search mode, matching the official local Codex client. */
const DEFAULT_CODEX_SEARCH_MODE = "cached";
/** Default provider search-context size. */
const DEFAULT_CODEX_SEARCH_CONTEXT_SIZE = "medium";
/** Default output budget for the standalone search response. */
const DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS = 1e4;
/** Default Codex routing model for `codex_generate_image`. */
const DEFAULT_CODEX_IMAGE_GENERATION_MODEL = "gpt-5.6-luna";
const DEFAULT_CODEX_SETTINGS = Object.freeze({
	streamIdleTimeoutMs: CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
	models: Object.freeze(defaultDisplayedCatalog()),
	enableSearch: false,
	enableImageTool: false,
	enableImageGeneration: false,
	searchModel: DEFAULT_CODEX_SEARCH_MODEL,
	imageGenerationModel: DEFAULT_CODEX_IMAGE_GENERATION_MODEL,
	searchMode: DEFAULT_CODEX_SEARCH_MODE,
	searchContextSize: DEFAULT_CODEX_SEARCH_CONTEXT_SIZE,
	searchMaxOutputTokens: DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS
});
function isRecord$6(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
const TOKEN_FIELD = /^(?:accessToken|refreshToken|access_token|refresh_token|id_token|idToken|token)$/iu;
function hasTokenFields(value) {
	return Object.keys(value).some((key) => TOKEN_FIELD.test(key));
}
function optionalString$1(record, key) {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function optionalBoolean(record, key) {
	const value = record[key];
	return typeof value === "boolean" ? value : void 0;
}
function optionalStrings(record, key) {
	const value = record[key];
	return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) ? value : void 0;
}
function optionalPositiveInt(record, key) {
	const value = record[key];
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : void 0;
}
/** Decode one catalog row; unknown extra fields are ignored. */
function decodeCodexCatalogModel(value) {
	if (!isRecord$6(value) || typeof value["id"] !== "string" || value["id"].trim().length === 0) return void 0;
	const model = { id: value["id"].trim() };
	const name = optionalString$1(value, "name");
	const description = optionalString$1(value, "description");
	const contextWindow = optionalPositiveInt(value, "contextWindow");
	const maxTokens = optionalPositiveInt(value, "maxTokens");
	const thinking = optionalBoolean(value, "thinking");
	const defaultEffort = optionalString$1(value, "defaultEffort");
	const efforts = optionalStrings(value, "efforts");
	const vision = optionalBoolean(value, "vision");
	const tools = optionalBoolean(value, "tools");
	const fast = optionalBoolean(value, "fast");
	if (name !== void 0) model.name = name;
	if (description !== void 0) model.description = description;
	if (contextWindow !== void 0) model.contextWindow = contextWindow;
	if (maxTokens !== void 0) model.maxTokens = maxTokens;
	if (thinking !== void 0) model.thinking = thinking;
	if (defaultEffort !== void 0) model.defaultEffort = defaultEffort;
	if (efforts !== void 0) model.efforts = efforts;
	if (vision !== void 0) model.vision = vision;
	if (tools !== void 0) model.tools = tools;
	if (fast !== void 0) model.fast = fast;
	return hydrateCatalogModel(model);
}
function decodeModels(value) {
	if (value === void 0) return [...DEFAULT_CODEX_SETTINGS.models];
	if (!Array.isArray(value)) return void 0;
	const models = [];
	const seen = /* @__PURE__ */ new Set();
	for (const item of value) {
		const model = decodeCodexCatalogModel(item);
		if (model === void 0 || seen.has(model.id)) return void 0;
		seen.add(model.id);
		models.push(model);
	}
	return models;
}
/** Narrow a Host model-catalog reply before it enters React state. */
function decodeCodexModelCatalog(value) {
	return value === void 0 ? void 0 : decodeModels(value);
}
/** Narrow a redacted settings payload before it enters React state. */
function decodeCodexSettings(value) {
	if (!isRecord$6(value) || hasTokenFields(value)) return void 0;
	const models = decodeModels(value["models"]);
	if (models === void 0) return void 0;
	const streamIdleTimeoutMs = value["streamIdleTimeoutMs"];
	const enableSearch = value["enableSearch"];
	const enableImageTool = value["enableImageTool"];
	const enableImageGeneration = value["enableImageGeneration"];
	const searchModel = value["searchModel"];
	const imageGenerationModel = value["imageGenerationModel"];
	const searchMode = value["searchMode"];
	const searchContextSize = value["searchContextSize"];
	const searchMaxOutputTokens = value["searchMaxOutputTokens"];
	if (streamIdleTimeoutMs !== void 0 && (typeof streamIdleTimeoutMs !== "number" || !Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0)) return;
	if (enableSearch !== void 0 && typeof enableSearch !== "boolean") return void 0;
	if (enableImageTool !== void 0 && typeof enableImageTool !== "boolean") return void 0;
	if (enableImageGeneration !== void 0 && typeof enableImageGeneration !== "boolean") return void 0;
	if (searchModel !== void 0 && (typeof searchModel !== "string" || searchModel.trim().length === 0)) return void 0;
	if (imageGenerationModel !== void 0 && (typeof imageGenerationModel !== "string" || imageGenerationModel.trim().length === 0)) return void 0;
	if (searchMode !== void 0 && searchMode !== "cached" && searchMode !== "indexed" && searchMode !== "live") return;
	if (searchContextSize !== void 0 && searchContextSize !== "low" && searchContextSize !== "medium" && searchContextSize !== "high") return;
	if (searchMaxOutputTokens !== void 0 && (typeof searchMaxOutputTokens !== "number" || !Number.isInteger(searchMaxOutputTokens) || searchMaxOutputTokens < 1)) return;
	return {
		streamIdleTimeoutMs: typeof streamIdleTimeoutMs === "number" ? streamIdleTimeoutMs : DEFAULT_CODEX_SETTINGS.streamIdleTimeoutMs,
		models,
		enableSearch: typeof enableSearch === "boolean" ? enableSearch : DEFAULT_CODEX_SETTINGS.enableSearch,
		enableImageTool: typeof enableImageTool === "boolean" ? enableImageTool : DEFAULT_CODEX_SETTINGS.enableImageTool,
		enableImageGeneration: typeof enableImageGeneration === "boolean" ? enableImageGeneration : DEFAULT_CODEX_SETTINGS.enableImageGeneration,
		searchModel: typeof searchModel === "string" ? searchModel.trim() : DEFAULT_CODEX_SETTINGS.searchModel,
		imageGenerationModel: typeof imageGenerationModel === "string" ? imageGenerationModel.trim() : DEFAULT_CODEX_SETTINGS.imageGenerationModel,
		searchMode: searchMode === "indexed" || searchMode === "live" ? searchMode : DEFAULT_CODEX_SETTINGS.searchMode,
		searchContextSize: searchContextSize === "low" || searchContextSize === "high" ? searchContextSize : DEFAULT_CODEX_SETTINGS.searchContextSize,
		searchMaxOutputTokens: typeof searchMaxOutputTokens === "number" ? searchMaxOutputTokens : DEFAULT_CODEX_SETTINGS.searchMaxOutputTokens
	};
}
/** Decode a browser save request. */
function decodeCodexSaveRequest(value) {
	if (!isRecord$6(value) || hasTokenFields(value)) return void 0;
	const settings = decodeCodexSettings(value);
	if (settings === void 0) return void 0;
	const expectedRevision = value["expectedRevision"];
	if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 0) return;
	return {
		models: settings.models,
		enableSearch: settings.enableSearch,
		enableImageTool: settings.enableImageTool,
		enableImageGeneration: settings.enableImageGeneration,
		searchModel: settings.searchModel,
		imageGenerationModel: settings.imageGenerationModel,
		searchMode: settings.searchMode,
		searchContextSize: settings.searchContextSize,
		searchMaxOutputTokens: settings.searchMaxOutputTokens,
		expectedRevision
	};
}
/** Decode a Host save reply. */
function decodeCodexSaveResult(value) {
	if (!isRecord$6(value) || hasTokenFields(value)) return void 0;
	const settings = decodeCodexSettings(value["settings"]);
	const revision = value["revision"];
	if (settings === void 0 || typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) return;
	return {
		settings,
		revision
	};
}
/** Frozen default catalog exported for tests and the picker. */
const CODEX_CATALOG = Object.freeze(defaultDisplayedCatalog());
//#endregion
//#region lib/types/service-tier.js
/** Rewrite an outbound Codex Responses body for Fast picker rows. */
function isRecord$5(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Apply the official wire id and Fast service tier to a Responses payload. */
function applyCodexWirePayload(payload, target) {
	if (!isRecord$5(payload)) return payload;
	return {
		...payload,
		model: target.wireId,
		...target.serviceTier === void 0 ? {} : { service_tier: target.serviceTier }
	};
}
/** Resolve a picker id then patch the payload. */
function applyCodexCatalogWire(payload, catalogId) {
	return applyCodexWirePayload(payload, resolveWireModel(catalogId));
}
//#endregion
//#region lib/types/pi-ai-profile.js
/**
* Translate the displayed Codex catalog into a pi-ai profile on the public
* `codex` route. Chat still uses openai-codex-responses; Fast rows rewrite
* the wire model id and inject service_tier.
*/
const CODEX_CHAT_BASE_URL = "https://chatgpt.com/backend-api";
const CODEX_DEFAULT_CONTEXT_WINDOW = 272e3;
const CODEX_DEFAULT_MODEL_MAX_TOKENS = 128e3;
const NO_COST = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0
};
function thinkingLevelMap(model) {
	const official = officialModelFor(model.id);
	if (official === void 0) return void 0;
	return { ...official.thinkingLevelMap };
}
function toPiAiModel(model) {
	const official = officialModelFor(model.id);
	const levels = thinkingLevelMap(model);
	return {
		id: model.id,
		name: model.name ?? model.id,
		api: "openai-codex-responses",
		provider: CODEX_PROVIDER,
		baseUrl: CODEX_CHAT_BASE_URL,
		reasoning: model.thinking !== false,
		...levels === void 0 ? {} : { thinkingLevelMap: levels },
		input: model.vision === false ? ["text"] : official?.vision === false ? ["text"] : ["text", "image"],
		cost: NO_COST,
		contextWindow: model.contextWindow ?? official?.contextWindow ?? 272e3,
		maxTokens: model.maxTokens ?? official?.maxTokens ?? 128e3,
		compat: {
			supportsDeveloperRole: false,
			supportsLongCacheRetention: false,
			supportsStrictMode: false,
			supportsOpenAIGrammarTools: true,
			supportsToolSearch: official?.id !== "gpt-5.3-codex-spark",
			supportsExplicitPromptCacheMode: false
		}
	};
}
function requestAuth() {
	return { apiKey: {
		name: "Codex OAuth bearer token",
		async resolve({ credential }) {
			const apiKey = credential?.key;
			return apiKey === void 0 || apiKey.length === 0 ? void 0 : {
				auth: { apiKey },
				source: "OAuth"
			};
		}
	} };
}
function withCodexWire(streamFn) {
	return (model, context, options) => {
		const target = resolveWireModel(model.id);
		const original = options?.onPayload;
		return streamFn(model, context, {
			...options,
			...target.serviceTier === void 0 ? {} : { serviceTier: target.serviceTier },
			onPayload: async (payload, nextModel) => {
				const next = original === void 0 ? payload : await original(payload, nextModel);
				return applyCodexWirePayload(next === void 0 ? payload : next, target);
			}
		});
	};
}
function codexResponsesApi() {
	const base = openAICodexResponsesApi();
	return {
		stream: withCodexWire(base.stream),
		streamSimple: withCodexWire(base.streamSimple)
	};
}
function createCodexPiAiProfile(connection) {
	const models = (connection.models.length > 0 ? connection.models : CODEX_CATALOG).map((model) => toPiAiModel(model));
	const piProvider = createProvider({
		id: CODEX_PROVIDER,
		name: "Codex",
		baseUrl: CODEX_CHAT_BASE_URL,
		auth: requestAuth(),
		models,
		api: codexResponsesApi()
	});
	return {
		provider: CODEX_PROVIDER,
		displayName: "Codex",
		baseURL: CODEX_CHAT_BASE_URL,
		defaultContextWindow: CODEX_DEFAULT_CONTEXT_WINDOW,
		defaultMaxTokens: CODEX_DEFAULT_MODEL_MAX_TOKENS,
		defaultInput: ["text"],
		/** Mirrors the official total base64 image payload limit per request. */
		maxRequestImageBytes: 20971520,
		/** Required by the RC2 resolved-profile contract for deterministic request images. */
		requestImagePixelBudget: 4194304,
		requestImageMaxBytes: 1048576,
		streamIdleTimeoutMs: connection.streamIdleTimeoutMs,
		retryPolicy: connection.retryPolicy,
		piProvider,
		configuredMaxTokens: /* @__PURE__ */ new Map()
	};
}
//#endregion
//#region lib/types/pi-ai-auth.js
/**
* Build isolated pi-ai auth inputs for the adapter's request collections.
*
* The adapter resolves the Codex access token through its durable plugin-owned
* store and supplies it as the request API key. This collection store therefore
* only satisfies pi-ai's required auth injection without creating another
* durable credential path; its records live for this adapter instance only.
* Ambient provider lookups deliberately find nothing.
*
* @returns an in-memory credential store and an empty ambient auth context.
*/
function createPiAiAuth() {
	const stored = /* @__PURE__ */ new Map();
	return {
		credentials: {
			/** Read a credential by pi-ai provider id. */
			read: async (providerId) => stored.get(providerId),
			/** List non-secret metadata for stored provider credentials. */
			list: async () => [...stored].map(([providerId, credential]) => ({
				providerId,
				type: credential.type
			})),
			/** Apply a serialized in-memory credential update. */
			async modify(providerId, mutate) {
				const next = await mutate(stored.get(providerId));
				if (next !== void 0) stored.set(providerId, next);
				return stored.get(providerId);
			},
			/** Remove a credential by pi-ai provider id. */
			async delete(providerId) {
				stored.delete(providerId);
			}
		},
		authContext: {
			/** Ambient environment variables are intentionally unavailable. */
			async env() {},
			/** Ambient filesystem credential sources are intentionally unavailable. */
			async fileExists() {
				return false;
			}
		}
	};
}
//#endregion
//#region lib/types/store.js
/**
* Owner-only persistent OAuth credential storage.
* The on-disk document is scoped to pi-ai's openai-codex provider id so
* login() can persist tokens; the public DSH route remains `codex`.
*/
/** pi-ai provider id used by ChatGPT OAuth and this store. */
const OPENAI_CODEX_PROVIDER = "openai-codex";
/** Basename of the OAuth document inside the Harness home. */
const CODEX_AUTH_FILENAME = "codex-oauth.json";
const AUTH_FORMAT_VERSION = 1;
function isENOENT(error) {
	return error?.code === "ENOENT";
}
async function assertOwnerOnly(filename) {
	let mode;
	try {
		mode = (await stat(filename)).mode;
	} catch (error) {
		if (isENOENT(error)) return;
		throw error;
	}
	if (process.platform === "win32") return;
	if ((mode & 63) !== 0) throw new Error(`codex: ${filename} is readable beyond its owner (mode ${(mode & 511).toString(8)}); run "chmod 600 ${filename}" before starting again`);
}
function parseDocument(text, filename) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error(`codex: ${filename} is not valid JSON`);
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`codex: ${filename} must contain an object`);
	const document = value;
	if (document["version"] !== AUTH_FORMAT_VERSION) throw new Error(`codex: ${filename} has unsupported auth format version ${String(document["version"])}`);
	if (Object.keys(document).some((key) => key !== "version" && key !== "credential")) throw new Error(`codex: ${filename} contains an unknown top-level field`);
	const raw = document["credential"];
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`codex: ${filename} credential must be an object`);
	const credential = raw;
	if (Object.keys(credential).some((key) => ![
		"type",
		"access",
		"refresh",
		"expires",
		"accountId"
	].includes(key))) throw new Error(`codex: ${filename} credential contains an unknown field`);
	if (credential["type"] !== "oauth") throw new Error(`codex: ${filename} credential type must be oauth`);
	for (const key of [
		"access",
		"refresh",
		"accountId"
	]) if (typeof credential[key] !== "string" || credential[key].length === 0) throw new Error(`codex: ${filename} credential ${key} must be a non-empty string`);
	if (typeof credential["expires"] !== "number" || !Number.isFinite(credential["expires"]) || credential["expires"] <= 0) throw new Error(`codex: ${filename} credential expires must be a positive finite number`);
	return {
		version: AUTH_FORMAT_VERSION,
		credential
	};
}
function cloneCredential(credential) {
	return structuredClone(credential);
}
/** Resolve the default OAuth document path. */
function codexAuthPath(dshHome) {
	return resolve(join(resolveDshHome(dshHome), CODEX_AUTH_FILENAME));
}
/** File-backed pi-ai store scoped to the single OpenAI Codex provider. */
var CodexCredentialStore = class {
	filename;
	constructor(filename = codexAuthPath()) {
		this.filename = resolve(filename);
	}
	async readCurrent() {
		await assertOwnerOnly(this.filename);
		let text;
		try {
			text = await readFile(this.filename, "utf8");
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
		return cloneCredential(parseDocument(text, this.filename).credential);
	}
	async read(providerId) {
		return providerId === "openai-codex" ? this.readCurrent() : void 0;
	}
	async list() {
		return await this.readCurrent() === void 0 ? [] : [{
			providerId: OPENAI_CODEX_PROVIDER,
			type: "oauth"
		}];
	}
	async modify(providerId, fn) {
		if (providerId !== "openai-codex") throw new Error(`codex: credential store does not own provider "${providerId}"`);
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		return withFileLock(this.filename, async () => {
			const current = await this.readCurrent();
			const candidate = await fn(current);
			if (candidate === void 0) return current;
			const document = parseDocument(JSON.stringify({
				version: AUTH_FORMAT_VERSION,
				credential: candidate
			}), this.filename);
			await writeFileAtomic(this.filename, `${JSON.stringify(document, null, 2)}\n`, {
				mode: 384,
				dirMode: 448
			});
			return cloneCredential(document.credential);
		});
	}
	async delete(providerId) {
		if (providerId !== "openai-codex") return;
		await mkdir(dirname(this.filename), {
			recursive: true,
			mode: 448
		});
		await withFileLock(this.filename, () => rm(this.filename, { force: true }));
	}
};
//#endregion
//#region lib/types/adapter.js
/**
* Codex subscription chat adapter. The public route is `codex`; the wire
* implementation is pi-ai openai-codex-responses plus Fast service_tier.
*/
/** Resolve the current ChatGPT access token, or throw a typed LlmError. */
async function resolveCodexAccessToken(store) {
	const models = createModels({ credentials: store });
	models.setProvider(openaiCodexProvider());
	const existing = await store.read(OPENAI_CODEX_PROVIDER);
	const access = (await models.getAuth(OPENAI_CODEX_PROVIDER))?.auth.apiKey;
	if (access === void 0 || access.length === 0) {
		if (existing !== void 0) throw new LlmError("llm-codex: session refresh failed; sign in again with ChatGPT", "AUTH");
		throw new LlmError("llm-codex: not signed in; sign in with ChatGPT from Plugin configuration", "MISSING_CREDENTIAL");
	}
	return access;
}
/**
* Force getAuth to refresh by marking the stored access token expired.
* @param store - Host-backed Codex OAuth store.
* @returns the refreshed ChatGPT access token.
*/
async function refreshCodexAccessToken(store) {
	await store.modify(OPENAI_CODEX_PROVIDER, async (current) => {
		if (current === void 0 || current.type !== "oauth") return current;
		return {
			...current,
			expires: 1
		};
	});
	return resolveCodexAccessToken(store);
}
function isAuthFinish(chunk) {
	return chunk.type === "finish" && chunk.reason.kind === "error" && chunk.reason.failure.code === "AUTH";
}
function isModelContent(chunk) {
	return chunk.type === "block-start" || chunk.type === "text-delta" || chunk.type === "reasoning-delta" || chunk.type === "tool-call-delta" || chunk.type === "block-end";
}
/**
* Replay a stream once after a content-less AUTH finish, forcing a token refresh first.
* @param stream - one request-scoped model stream factory.
* @param options - the same generate options passed to both attempts.
* @param classify - per-chunk error remapping applied to both attempts.
* @param refreshApiKey - force-refresh hook; omitted means AUTH is not retried here.
* @returns chunks from the first successful attempt, or the original AUTH finish.
*/
async function* streamWithAuthRetry(stream, options, classify, refreshApiKey) {
	const buffered = [];
	let sawContent = false;
	for await (const raw of stream(options)) {
		const chunk = classify(raw);
		if (isAuthFinish(chunk) && !sawContent && refreshApiKey !== void 0) {
			try {
				await refreshApiKey();
			} catch (error) {
				if (options.signal?.aborted === true || error instanceof Error && error.name === "AbortError") throw error;
				yield* buffered;
				yield chunk;
				return;
			}
			options.signal?.throwIfAborted();
			for await (const retryRaw of stream(options)) yield classify(retryRaw);
			return;
		}
		if (isModelContent(chunk)) {
			sawContent = true;
			yield* buffered;
			buffered.length = 0;
			yield chunk;
			continue;
		}
		if (sawContent) yield chunk;
		else buffered.push(chunk);
	}
	yield* buffered;
}
/**
* Apply the plugin-owned default only when pi-ai advertises that exact level.
* A conversation's explicit reasoningEffort still takes precedence in DSH.
*/
function applyCodexDefaultReasoningMetadata(info, model, override) {
	if (info.reasoning === void 0) return info;
	const wanted = override ?? defaultCodexReasoningEffort(model);
	const defaultEffort = ReasoningEffortId(wanted);
	if (!info.reasoning.efforts.some((effort) => effort.id === defaultEffort)) return info;
	return {
		...info,
		reasoning: {
			...info.reasoning,
			defaultEffort
		}
	};
}
/**
* Classify ChatGPT WebSocket failures that pi-ai reports without an HTTP status.
* @param chunk - One delegated DSH stream chunk.
* @returns The original chunk, or a copy with a retryable transport code.
*/
function classifyCodexTransientError(chunk) {
	if (chunk.type !== "finish" || chunk.reason.kind !== "error" || chunk.reason.failure.code !== "PI_AI_ERROR") return chunk;
	const message = chunk.reason.failure.message;
	const closed = /^WebSocket closed(?:\s+(\d+))?(?:\s+.*)?$/iu.exec(message);
	const transport = /^WebSocket (?:error|stream closed before response\.completed)$/iu.test(message) || closed !== null && closed[1] !== "1009";
	const code = /failed to extract accountId from token|invalid token|no account ID in token|OpenAI Codex token refresh failed/iu.test(message) ? "AUTH" : transport ? "TRANSPORT" : /overloaded|service unavailable|websocket_connection_limit_reached/iu.test(message) ? "SERVER" : void 0;
	if (code === void 0) return chunk;
	return {
		...chunk,
		reason: {
			...chunk.reason,
			failure: {
				...chunk.reason.failure,
				code
			}
		}
	};
}
const SANDBOX_MODE_RANK = {
	"read-only": 0,
	"workspace-write": 1,
	"danger-full-access": 2
};
/**
* Remove sandbox escalation choices that cannot be strictly wider than the
* current DSH policy. Core still validates every retained request; this only
* prevents Codex from selecting an impossible optional enum value.
*/
function narrowCodexEscalationSchemas(options) {
	const mode = sandboxModeOf(options);
	const currentRank = mode === void 0 ? void 0 : SANDBOX_MODE_RANK[mode];
	if (currentRank === void 0 || options.tools === void 0) return options;
	let changed = false;
	const tools = options.tools.map((tool) => {
		const parameters = tool.parameters;
		const properties = isRecord$4(parameters.properties) ? parameters.properties : void 0;
		const permission = properties === void 0 || !isRecord$4(properties.sandbox_permissions) ? void 0 : properties.sandbox_permissions;
		if (permission === void 0 || !Array.isArray(permission.enum)) return tool;
		const wider = permission.enum.filter((candidate) => {
			return typeof candidate === "string" && (SANDBOX_MODE_RANK[candidate] ?? -1) > currentRank;
		});
		if (wider.length === permission.enum.length) return tool;
		changed = true;
		const nextProperties = { ...properties };
		if (wider.length === 0) {
			delete nextProperties.sandbox_permissions;
			delete nextProperties.justification;
		} else nextProperties.sandbox_permissions = {
			...permission,
			enum: wider
		};
		const required = Array.isArray(parameters.required) ? parameters.required.filter((name) => name !== "sandbox_permissions" && name !== "justification") : void 0;
		return {
			...tool,
			parameters: {
				...parameters,
				properties: nextProperties,
				...required === void 0 ? {} : { required }
			}
		};
	});
	return changed ? {
		...options,
		tools
	} : options;
}
function sandboxModeOf(options) {
	for (let index = options.messages.length - 1; index >= 0; index -= 1) {
		const message = options.messages[index];
		if (!isRecord$4(message)) continue;
		const found = sandboxModeIn(message.content);
		if (found !== void 0) return found;
	}
	return sandboxModeIn(options.system);
}
function sandboxModeIn(value) {
	if (typeof value === "string") return /Current DSH file policy:\s*(read-only|workspace-write|danger-full-access)\./u.exec(value)?.[1];
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = sandboxModeIn(item);
			if (found !== void 0) return found;
		}
		return;
	}
	if (!isRecord$4(value)) return void 0;
	return sandboxModeIn(value.text) ?? sandboxModeIn(value.content);
}
function isRecord$4(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** ChatGPT subscription adapter backed by pi-ai Codex Responses. */
var CodexAdapter = class extends LlmAdapter {
	config;
	auth = createPiAiAuth();
	snapshot;
	constructor(config) {
		super();
		this.config = config;
	}
	current() {
		const options = this.config.options();
		if (this.snapshot?.options === options) return this.snapshot.adapter;
		const profile = createCodexPiAiProfile(options);
		const profiles = /* @__PURE__ */ new Map([[CODEX_PROVIDER, profile]]);
		const adapterOptions = {
			profiles: () => profiles,
			resolveApiKey: () => this.config.resolveApiKey(),
			auth: this.auth,
			...this.config.resolveAttachments === void 0 ? {} : { resolveAttachments: this.config.resolveAttachments }
		};
		const adapter = new PiAiAdapter(adapterOptions);
		this.snapshot = {
			options,
			adapter
		};
		return adapter;
	}
	providerInfo(provider) {
		return this.current().providerInfo(provider);
	}
	providerRetryPolicy(provider) {
		return this.current().providerRetryPolicy(provider);
	}
	/**
	* Declare neutral request-image pricing when a newer Host calls this adapter.
	* @param _provider - provider route.
	* @param _model - model id.
	* @returns `undefined` so the Host uses heuristic image pricing.
	*/
	imageRequestPricing(_provider, _model) {}
	async listModels(provider) {
		this.snapshot = void 0;
		return this.current().listModels(provider);
	}
	async resolveModel(provider, model, signal) {
		return applyCodexDefaultReasoningMetadata(await this.current().resolveModel(provider, model, signal), model, this.config.options().models.find((entry) => entry.id === model)?.defaultEffort);
	}
	async *stream(options) {
		yield* streamWithAuthRetry((opts) => this.current().stream(narrowCodexEscalationSchemas(opts)), options, classifyCodexTransientError, this.config.refreshApiKey);
	}
	/** Own the method so rc.2 Host can call it even when this class extends an older LlmAdapter. */
	async prepareCall(provider, model, signal) {
		const delegate = this.current();
		const inner = typeof delegate.prepareCall === "function" ? await delegate.prepareCall(provider, model, signal) : {
			model: await this.resolveModel(provider, model, signal),
			stream: (options) => delegate.stream(options)
		};
		const refreshApiKey = this.config.refreshApiKey;
		return {
			model: inner.model,
			stream: (options) => streamWithAuthRetry((opts) => inner.stream(narrowCodexEscalationSchemas(opts)), options, classifyCodexTransientError, refreshApiKey)
		};
	}
};
//#endregion
//#region lib/types/auth.js
/** ChatGPT OAuth orchestration shared by the plugin Host. */
/** Complete provider-native OAuth and persist the resulting credential. */
async function loginCodex(interaction, store = new CodexCredentialStore()) {
	const models = createModels({ credentials: store });
	models.setProvider(openaiCodexProvider());
	await models.login(OPENAI_CODEX_PROVIDER, "oauth", interaction);
}
/** Remove the stored Codex credential. */
async function logoutCodex(store = new CodexCredentialStore()) {
	await store.delete(OPENAI_CODEX_PROVIDER);
}
/** Read non-secret login state without refreshing the token. */
async function codexAuthStatus(store = new CodexCredentialStore()) {
	const credential = await store.read(OPENAI_CODEX_PROVIDER);
	return credential?.type === "oauth" ? {
		authenticated: true,
		expiresAt: new Date(credential.expires)
	} : { authenticated: false };
}
//#endregion
//#region lib/types/usage.js
/** Live ChatGPT Codex rate-limit usage for the browser account page. */
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const USAGE_REQUEST_TIMEOUT_MS = 15e3;
const CODEX_REAUTH_REQUIRED_CODE = "CODEX_REAUTH_REQUIRED";
const CODEX_REAUTH_REQUIRED_MESSAGE = "Codex authorization must be renewed";
var CodexReauthRequiredError = class extends Error {
	code = CODEX_REAUTH_REQUIRED_CODE;
	constructor() {
		super(CODEX_REAUTH_REQUIRED_MESSAGE);
		this.name = "CodexReauthRequiredError";
	}
};
function isCodexReauthRequiredError(error) {
	return error instanceof CodexReauthRequiredError;
}
function isRecord$3(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isoInstant(value) {
	if (typeof value === "string" && value.length > 0) {
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) ? new Date(parsed).toISOString() : void 0;
	}
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		const ms = value < 0xe8d4a51000 ? value * 1e3 : value;
		const date = new Date(ms);
		return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
	}
}
function parseResetAt(record, now) {
	const direct = isoInstant(record["reset_at"] ?? record["resetAt"] ?? record["resetsAt"]);
	if (direct !== void 0) return direct;
	const after = record["reset_after_seconds"] ?? record["resetAfterSeconds"];
	if (typeof after === "number" && Number.isFinite(after) && after >= 0) return new Date(now + after * 1e3).toISOString();
}
function parseWindow(value, now) {
	if (value === void 0 || value === null) return void 0;
	if (!isRecord$3(value)) throw new Error("Codex returned a malformed rate-limit window");
	const usedPercent = value["used_percent"];
	const windowSeconds = value["limit_window_seconds"];
	if (typeof usedPercent !== "number" || !Number.isFinite(usedPercent) || usedPercent < 0 || usedPercent > 100) throw new Error("Codex returned an invalid used percentage");
	if (typeof windowSeconds !== "number" || !Number.isInteger(windowSeconds) || windowSeconds <= 0) throw new Error("Codex returned an invalid rate-limit window duration");
	const resetsAt = parseResetAt(value, now);
	return {
		remainingPercent: 100 - usedPercent,
		windowSeconds,
		...resetsAt === void 0 ? {} : { resetsAt }
	};
}
function parseLimit(id, name, value, now) {
	if (value === void 0 || value === null) return void 0;
	if (!isRecord$3(value)) throw new Error("Codex returned malformed rate-limit details");
	const windows = [parseWindow(value["primary_window"], now), parseWindow(value["secondary_window"], now)].filter((window) => window !== void 0);
	return windows.length === 0 ? void 0 : {
		id,
		...name === void 0 ? {} : { name },
		windows
	};
}
function exactAmount(record, key) {
	const value = record[key];
	if (typeof value !== "string" || value.length === 0 || value.length > 64 || !/^-?\d+(?:\.\d+)?$/u.test(value)) throw new Error(`Codex returned an invalid ${key} amount`);
	return value;
}
function parseCredits(value) {
	if (value === void 0 || value === null) return void 0;
	if (!isRecord$3(value) || typeof value["has_credits"] !== "boolean" || typeof value["unlimited"] !== "boolean") throw new Error("Codex returned malformed credit details");
	if (!value["has_credits"]) return void 0;
	const balance = value["balance"];
	if (balance !== void 0 && balance !== null && (typeof balance !== "string" || balance.length === 0 || balance.length > 64 || !/^-?\d+(?:\.\d+)?$/u.test(balance))) throw new Error("Codex returned an invalid credit balance");
	return {
		unlimited: value["unlimited"],
		...typeof balance === "string" ? { balance } : {}
	};
}
function parseIndividualLimit(value) {
	if (value === void 0 || value === null) return void 0;
	if (!isRecord$3(value)) throw new Error("Codex returned malformed spend-control details");
	const individual = value["individual_limit"];
	if (individual === void 0 || individual === null) return void 0;
	if (!isRecord$3(individual)) throw new Error("Codex returned a malformed individual limit");
	const remainingPercent = individual["remaining_percent"];
	if (typeof remainingPercent !== "number" || !Number.isFinite(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) throw new Error("Codex returned an invalid individual-limit percentage");
	return {
		limit: exactAmount(individual, "limit"),
		used: exactAmount(individual, "used"),
		remaining: exactAmount(individual, "remaining"),
		remainingPercent
	};
}
/** Convert the provider response into the small secret-free object sent to the browser. */
function parseCodexUsage(value, now = Date.now()) {
	if (!isRecord$3(value)) throw new Error("Codex returned a malformed usage response");
	const limitsById = /* @__PURE__ */ new Map();
	const appendLimit = (limit) => {
		const existing = limitsById.get(limit.id);
		if (existing === void 0) {
			limitsById.set(limit.id, limit);
			return;
		}
		const knownWindowSeconds = new Set(existing.windows.map((window) => window.windowSeconds));
		const windows = [...existing.windows, ...limit.windows.filter((window) => !knownWindowSeconds.has(window.windowSeconds))];
		limitsById.set(limit.id, {
			...existing,
			...existing.name === void 0 && limit.name !== void 0 ? { name: limit.name } : {},
			windows
		});
	};
	const primary = parseLimit("codex", "Codex", value["rate_limit"], now);
	if (primary !== void 0) appendLimit(primary);
	const additional = value["additional_rate_limits"];
	if (additional !== void 0 && additional !== null && !Array.isArray(additional)) throw new Error("Codex returned malformed additional rate limits");
	for (const item of additional ?? []) {
		if (!isRecord$3(item)) throw new Error("Codex returned a malformed additional rate limit");
		const id = item["metered_feature"];
		const name = item["limit_name"];
		if (typeof id !== "string" || id.length === 0) throw new Error("Codex returned an additional rate limit without an id");
		if (name !== void 0 && name !== null && typeof name !== "string") throw new Error("Codex returned an invalid additional rate-limit name");
		const limit = parseLimit(id, typeof name === "string" && name.length > 0 ? name : void 0, item["rate_limit"], now);
		if (limit !== void 0) appendLimit(limit);
	}
	const limits = [...limitsById.values()];
	const credits = parseCredits(value["credits"]);
	const individualLimit = parseIndividualLimit(value["spend_control"]);
	return {
		rateLimits: limits,
		...credits === void 0 ? {} : { credits },
		...individualLimit === void 0 ? {} : { individualLimit }
	};
}
/** Read current quota without issuing a model request. */
async function readCodexRateLimits(store) {
	const models = createModels({ credentials: store });
	models.setProvider(openaiCodexProvider());
	const auth = await models.getAuth(OPENAI_CODEX_PROVIDER);
	const credential = await store.read(OPENAI_CODEX_PROVIDER);
	const access = auth?.auth.apiKey;
	const accountId = credential?.type === "oauth" ? credential.accountId : void 0;
	if (access === void 0 || access.length === 0 || typeof accountId !== "string" || accountId.length === 0) throw new Error("Codex is signed out");
	const response = await fetch(CODEX_USAGE_URL, {
		method: "GET",
		redirect: "error",
		headers: {
			authorization: `Bearer ${access}`,
			"chatgpt-account-id": accountId,
			accept: "application/json",
			"cache-control": "no-store",
			"user-agent": "dsh-llm-codex"
		},
		signal: AbortSignal.timeout(USAGE_REQUEST_TIMEOUT_MS)
	});
	if (!response.ok) {
		if (response.status === 401 || response.status === 403) throw new CodexReauthRequiredError();
		throw new Error(`Codex usage request failed with HTTP ${response.status}`);
	}
	let value;
	try {
		value = await response.json();
	} catch (error) {
		throw new Error("Codex returned an unreadable usage response", { cause: error });
	}
	return parseCodexUsage(value);
}
function codexUsageEmpty(usage) {
	return usage.rateLimits.length === 0 && usage.credits === void 0 && usage.individualLimit === void 0;
}
function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, "$1[redacted]").slice(0, 1e3);
}
function rejectOnAbort(signal) {
	const reason = signal.reason;
	return reason instanceof Error ? reason : /* @__PURE__ */ new Error("Codex sign-in cancelled");
}
function waitForPromptAbort(prompt, extra) {
	const signals = [prompt.signal, extra].filter((signal) => signal !== void 0);
	if (signals.length === 0) return new Promise(() => {});
	for (const signal of signals) if (signal.aborted) return Promise.reject(rejectOnAbort(signal));
	return new Promise((_resolve, reject) => {
		for (const signal of signals) signal.addEventListener("abort", () => {
			reject(rejectOnAbort(signal));
		}, { once: true });
	});
}
var CodexWebAuth = class {
	store;
	state = { status: "signed-out" };
	operation;
	cancellation;
	challenge;
	challengeWaiters = [];
	challengeTimer;
	challengeTimeoutMs;
	openBrowser;
	loginMethod = "browser";
	attemptId;
	usageRefresh;
	attempts = /* @__PURE__ */ new Map();
	constructor(store, options = {}) {
		this.store = store;
		this.challengeTimeoutMs = options.challengeTimeoutMs ?? 3e4;
		this.openBrowser = options.openBrowser;
		if (!Number.isFinite(this.challengeTimeoutMs) || this.challengeTimeoutMs <= 0) throw new TypeError("Codex auth URL timeout must be a positive finite number");
	}
	async status(refresh = false) {
		if (this.operation !== void 0) return this.state;
		if (this.state.status === "error") return this.state;
		if (this.state.status === "signed-in") {
			if (refresh || codexUsageEmpty(this.state.usage)) await this.refreshUsage();
			return this.state;
		}
		return this.readStoredStatus();
	}
	async signIn(method = "browser") {
		if (this.operation === void 0) this.start(method);
		else if (method !== this.loginMethod) throw new Error("Codex sign-in is already in progress with another method");
		const challenge = this.challenge ?? await new Promise((resolve, reject) => {
			this.challengeWaiters.push({
				resolve,
				reject
			});
		});
		if (challenge.url !== void 0 && this.openBrowser !== void 0) try {
			await this.openBrowser(challenge.url);
		} catch (error) {
			const failure = error instanceof Error ? error : new Error(safeMessage(error));
			this.cancelSignIn(failure);
			throw failure;
		}
		return challenge;
	}
	attemptStatus(attemptId) {
		return this.attempts.get(attemptId)?.status ?? "missing";
	}
	cancel(attemptId) {
		if (attemptId !== void 0 && this.attemptId !== attemptId) return false;
		const active = this.attemptId;
		if (active !== void 0) this.rememberAttempt(active, "cancelled");
		this.cancelSignIn(/* @__PURE__ */ new Error("Codex sign-in cancelled"));
		return true;
	}
	async signOut() {
		this.cancelSignIn(/* @__PURE__ */ new Error("Codex sign-in cancelled"));
		await this.operation?.catch(() => void 0);
		await logoutCodex(this.store);
		this.challenge = void 0;
		this.state = { status: "signed-out" };
	}
	async dispose() {
		this.cancelSignIn(/* @__PURE__ */ new Error("Codex plugin disposed"));
		await this.operation?.catch(() => void 0);
	}
	start(method) {
		const cancellation = new AbortController();
		this.cancellation = cancellation;
		this.loginMethod = method;
		this.attemptId = randomUUID();
		this.rememberAttempt(this.attemptId, "pending");
		this.challenge = void 0;
		this.state = { status: "signing-in" };
		this.challengeTimer = setTimeout(() => {
			this.cancelSignIn(/* @__PURE__ */ new Error(`Codex did not provide an authorization URL within ${String(this.challengeTimeoutMs)}ms`));
		}, this.challengeTimeoutMs);
		this.challengeTimer.unref();
		this.operation = loginCodex({
			signal: cancellation.signal,
			prompt: (prompt) => prompt.type === "select" ? Promise.resolve(this.loginMethod) : waitForPromptAbort(prompt, cancellation.signal),
			notify: (event) => {
				this.onEvent(event);
			}
		}, this.store).then(async () => {
			if (this.challenge === void 0) {
				const error = /* @__PURE__ */ new Error("Codex sign-in finished without an authorization URL");
				this.rejectChallenge(error);
				this.state = {
					status: "error",
					message: safeMessage(error)
				};
				if (this.attemptId !== void 0) this.rememberAttempt(this.attemptId, "failed");
				return;
			}
			this.state = await this.readStoredStatus();
			if (this.attemptId !== void 0) this.rememberAttempt(this.attemptId, "succeeded");
		}, (error) => {
			this.rejectChallenge(error);
			const attemptId = this.attemptId;
			if (attemptId !== void 0 && this.attemptStatus(attemptId) === "cancelled") {
				this.state = { status: "signed-out" };
				return;
			}
			this.state = {
				status: "error",
				message: safeMessage(error)
			};
			if (attemptId !== void 0) this.rememberAttempt(attemptId, "failed");
		}).finally(() => {
			this.clearChallengeTimer();
			this.operation = void 0;
			this.cancellation = void 0;
			this.attemptId = void 0;
		});
	}
	onEvent(event) {
		const attemptId = this.attemptId;
		if (attemptId === void 0) {
			this.cancelSignIn(/* @__PURE__ */ new Error("OpenAI returned an authorization challenge without an active attempt"));
			return;
		}
		if (event.type === "device_code") {
			if (event.verificationUri.length === 0 || event.userCode.length === 0) {
				this.cancelSignIn(/* @__PURE__ */ new Error("OpenAI returned an invalid device challenge"));
				return;
			}
			this.challenge = {
				verificationUri: event.verificationUri,
				userCode: event.userCode,
				...event.expiresInSeconds === void 0 ? {} : { expiresAt: Date.now() + event.expiresInSeconds * 1e3 },
				attemptId
			};
		} else if (event.type === "auth_url") {
			let url;
			try {
				url = new URL(event.url);
			} catch {
				this.cancelSignIn(/* @__PURE__ */ new Error("OpenAI returned an invalid authorization URL"));
				return;
			}
			if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
				this.cancelSignIn(/* @__PURE__ */ new Error("OpenAI returned an unsafe authorization URL"));
				return;
			}
			this.challenge = {
				url: event.url,
				attemptId
			};
		} else return;
		this.clearChallengeTimer();
		for (const waiter of this.challengeWaiters.splice(0)) waiter.resolve(this.challenge);
	}
	async readStoredStatus() {
		if (!(await codexAuthStatus(this.store)).authenticated) return { status: "signed-out" };
		this.state = {
			status: "signed-in",
			usage: { rateLimits: [] }
		};
		await this.refreshUsage();
		return this.state;
	}
	async refreshUsage() {
		if (this.usageRefresh !== void 0) return this.usageRefresh;
		this.usageRefresh = readCodexRateLimits(this.store).then((usage) => {
			if (this.state.status === "signed-in") this.state = {
				status: "signed-in",
				usage
			};
		}).catch((error) => {
			if (this.state.status !== "signed-in") return;
			if (isCodexReauthRequiredError(error)) this.state = {
				status: "reauth-required",
				message: CODEX_REAUTH_REQUIRED_MESSAGE
			};
			else this.state = {
				status: "signed-in",
				usage: { rateLimits: [] },
				quotaError: safeMessage(error)
			};
		}).finally(() => {
			this.usageRefresh = void 0;
		});
		return this.usageRefresh;
	}
	rememberAttempt(id, status) {
		this.attempts.set(id, {
			status,
			seenAt: Date.now()
		});
		while (this.attempts.size > 32) this.attempts.delete(this.attempts.keys().next().value);
	}
	rejectChallenge(error) {
		this.clearChallengeTimer();
		for (const waiter of this.challengeWaiters.splice(0)) waiter.reject(error);
	}
	clearChallengeTimer() {
		if (this.challengeTimer === void 0) return;
		clearTimeout(this.challengeTimer);
		this.challengeTimer = void 0;
	}
	cancelSignIn(error) {
		this.rejectChallenge(error);
		this.cancellation?.abort(error);
	}
};
function loopbackHost(rawHost) {
	if (/[\\/@?#]/u.test(rawHost)) return false;
	try {
		const parsed = new URL(`http://${rawHost}`);
		if (parsed.username !== "" || parsed.password !== "" || parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") return false;
		const hostname = (parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]") ? parsed.hostname.slice(1, -1) : parsed.hostname).toLowerCase().replace(/\.$/u, "");
		return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1" || hostname === "::ffff:127.0.0.1";
	} catch {
		return false;
	}
}
function exactOrigin(req, rawHost, rawOrigin) {
	try {
		const origin = new URL(rawOrigin);
		if (origin.username !== "" || origin.password !== "" || origin.pathname !== "/" || origin.search !== "" || origin.hash !== "") return false;
		const encrypted = req.socket.encrypted === true;
		return origin.origin === new URL(`${encrypted ? "https" : "http"}://${rawHost}`).origin;
	} catch {
		return false;
	}
}
function trustedRequest(req) {
	const remote = req.socket.remoteAddress;
	if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (typeof host !== "string" || !loopbackHost(host)) return false;
	const origin = req.headers.origin;
	if (origin === void 0) return true;
	return typeof origin === "string" && exactOrigin(req, host, origin);
}
function json(res, status, value) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"x-content-type-options": "nosniff"
	});
	res.end(JSON.stringify(value));
}
function registerCodexAuthRoutes(ctx, store, sharedAuth) {
	const auth = sharedAuth ?? new CodexWebAuth(store);
	ctx.effect(() => {
		const routes = [
			ctx.webServer.register({
				kind: "exact",
				path: CODEX_AUTH_STATUS_PATH,
				handler: async (req, res) => {
					if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					json(res, 200, await auth.status());
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: CODEX_AUTH_LOGIN_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						json(res, 200, await auth.signIn());
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			}),
			ctx.webServer.register({
				kind: "exact",
				path: CODEX_AUTH_LOGOUT_PATH,
				handler: async (req, res) => {
					if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
					if (!trustedRequest(req)) return json(res, 403, { error: "forbidden" });
					try {
						await auth.signOut();
						json(res, 200, { ok: true });
					} catch (error) {
						json(res, 500, { error: safeMessage(error) });
					}
				}
			})
		];
		return async () => {
			for (const dispose of routes) dispose();
			await auth.dispose();
		};
	}, "dsh-llm-codex: Web OAuth routes");
}
//#endregion
//#region lib/types/chatgpt-account.js
/** ChatGPT account id from a Codex OAuth access JWT. */
const AUTH_CLAIM = "https://api.openai.com/auth";
/** Read `chatgpt_account_id` from a ChatGPT access token. */
function chatgptAccountIdFromToken(access) {
	const parts = access.split(".");
	if (parts.length !== 3 || parts[1] === void 0) throw new Error("OpenAI Codex auth token is not a JWT. Sign in again with ChatGPT.");
	let payload;
	try {
		payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
	} catch {
		throw new Error("OpenAI Codex auth token is not a JWT. Sign in again with ChatGPT.");
	}
	const auth = payload[AUTH_CLAIM];
	if (typeof auth !== "object" || auth === null || Array.isArray(auth)) throw new Error("OpenAI Codex auth token has no ChatGPT account id. Sign in again with ChatGPT.");
	const accountId = auth["chatgpt_account_id"];
	if (typeof accountId !== "string" || accountId.length === 0) throw new Error("OpenAI Codex auth token has no ChatGPT account id. Sign in again with ChatGPT.");
	return accountId;
}
//#endregion
//#region lib/types/image-bytes.js
/** Magic-byte sniffing for the image tools. */
/** Detect PNG, JPEG, WebP, or GIF from a leading signature. */
function mediaTypeOf(data) {
	if (data.length >= 8 && data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71 && data[4] === 13 && data[5] === 10 && data[6] === 26 && data[7] === 10) return "image/png";
	if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
	if (data.length >= 6) {
		const signature = String.fromCharCode(...data.subarray(0, 6));
		if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
	}
	if (data.length >= 12 && String.fromCharCode(...data.subarray(0, 4)) === "RIFF" && String.fromCharCode(...data.subarray(8, 12)) === "WEBP") return "image/webp";
}
//#endregion
//#region lib/types/search.js
/**
* Codex standalone web search over the dsh web provider seam.
*/
const CODEX_SEARCH_PROVIDER = CODEX_PROVIDER;
const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_SEARCH_URL = `${CODEX_BASE_URL}/alpha/search`;
function externalWebAccess(mode) {
	switch (mode) {
		case "cached": return false;
		case "indexed": return "indexed";
		case "live": return true;
	}
}
function accountIdFromToken(access) {
	try {
		return chatgptAccountIdFromToken(access);
	} catch (error) {
		throw new WebError("Codex search credential has no usable account id; sign in again", "WEB_PROVIDER_CREDENTIAL_MISSING", { cause: error });
	}
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalString(record, key) {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function citeableUrl(value) {
	if (typeof value !== "string") return void 0;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? value : void 0;
	} catch {
		return;
	}
}
function mapCodexSearchResponse(value) {
	if (!isRecord$2(value) || typeof value["output"] !== "string") throw new WebError("Codex returned a search response without string output", "WEB_PROVIDER_ERROR");
	const output = value["output"];
	const rawResults = value["results"];
	if (rawResults !== void 0 && !Array.isArray(rawResults)) throw new WebError("Codex returned a search response with non-array results", "WEB_PROVIDER_ERROR");
	const sources = [];
	const seen = /* @__PURE__ */ new Set();
	for (const item of rawResults ?? []) {
		if (!isRecord$2(item) || item["type"] !== "text_result") continue;
		const url = citeableUrl(item["url"]);
		if (url === void 0 || seen.has(url)) continue;
		seen.add(url);
		const title = optionalString(item, "title");
		const snippet = optionalString(item, "snippet");
		sources.push({
			url,
			...title === void 0 ? {} : { title },
			...snippet === void 0 ? {} : { snippet }
		});
	}
	return {
		...output.length === 0 ? {} : { content: output },
		sources,
		truncated: false
	};
}
function searchAborted(signal, fallback) {
	return new WebError("Codex search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}
function throwIfSearchAborted(signal) {
	if (signal?.aborted === true) throw searchAborted(signal);
}
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError";
}
function abortable(operation, signal) {
	if (signal === void 0) return operation;
	if (signal.aborted) return Promise.reject(searchAborted(signal));
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			reject(searchAborted(signal));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		operation.then((value) => {
			signal.removeEventListener("abort", onAbort);
			resolve(value);
		}, (error) => {
			signal.removeEventListener("abort", onAbort);
			reject(error);
		});
	});
}
function providerMessage(value) {
	if (!isRecord$2(value)) return void 0;
	const error = value["error"];
	return (typeof error === "string" ? error : isRecord$2(error) && typeof error["message"] === "string" ? error["message"] : typeof value["message"] === "string" ? value["message"] : void 0)?.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[REDACTED]").slice(0, 1e3);
}
var CodexSearchProvider = class {
	options;
	id = CODEX_SEARCH_PROVIDER;
	models;
	constructor(options) {
		this.options = options;
		const models = createModels({ credentials: options.credentials });
		models.setProvider(openaiCodexProvider());
		this.models = models;
	}
	available() {
		return this.options.model.length > 0 && Number.isInteger(this.options.maxOutputTokens) && this.options.maxOutputTokens > 0;
	}
	async search(request, signal) {
		throwIfSearchAborted(signal);
		let auth;
		try {
			auth = await abortable(this.models.getAuth(OPENAI_CODEX_PROVIDER), signal);
		} catch (error) {
			throwIfSearchAborted(signal);
			if (isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError("Codex search credential resolution failed", "WEB_PROVIDER_ERROR", { cause: error });
		}
		const access = auth?.auth.apiKey;
		if (access === void 0 || access.length === 0) throw new WebError("Codex search is signed out; sign in from Plugin configuration", "WEB_PROVIDER_CREDENTIAL_MISSING");
		const accountId = accountIdFromToken(access);
		throwIfSearchAborted(signal);
		const body = {
			id: this.options.resolveRequestId(),
			model: this.options.model,
			input: [{
				type: "message",
				role: "user",
				content: [{
					type: "input_text",
					text: request.query
				}]
			}],
			commands: { search_query: [{ q: request.query }] },
			settings: {
				search_context_size: this.options.contextSize,
				allowed_callers: ["direct"],
				external_web_access: externalWebAccess(this.options.mode)
			},
			max_output_tokens: this.options.maxOutputTokens
		};
		throwIfSearchAborted(signal);
		let response;
		try {
			response = await fetch(CODEX_SEARCH_URL, {
				method: "POST",
				redirect: "error",
				headers: {
					authorization: `Bearer ${access}`,
					"chatgpt-account-id": accountId,
					"content-type": "application/json",
					accept: "application/json",
					originator: "deepseek-harness"
				},
				body: JSON.stringify(body),
				...signal === void 0 ? {} : { signal }
			});
		} catch (error) {
			throwIfSearchAborted(signal);
			if (isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError("Codex search request failed", "WEB_PROVIDER_ERROR", { cause: error });
		}
		let payload;
		try {
			payload = await response.json();
		} catch (error) {
			throwIfSearchAborted(signal);
			if (isAbortError(error)) throw searchAborted(signal, error);
			throw new WebError(`Codex returned an unprocessable search response (HTTP ${response.status})`, "WEB_PROVIDER_ERROR", { cause: error });
		}
		if (!response.ok) {
			const detail = providerMessage(payload);
			const message = detail === void 0 ? `Codex search failed (HTTP ${response.status})` : `Codex search failed (HTTP ${response.status}): ${detail}`;
			throw new WebError(response.status === 401 || response.status === 403 ? `${message}; sign in again` : message, response.status === 401 || response.status === 403 ? "WEB_PROVIDER_CREDENTIAL_MISSING" : "WEB_PROVIDER_ERROR");
		}
		return mapCodexSearchResponse(payload);
	}
};
//#endregion
//#region lib/types/image-generation-client.js
/**
* Isolated Codex Responses client for hosted image_generation.
* Protocol can change without touching the DSH tool surface.
*/
const CODEX_RESPONSES_URL = CODEX_BASE_URL + "/responses";
const CODEX_IMAGE_ORIGINATOR = "deepseek-harness";
const CODEX_IMAGE_BETA = "responses=experimental";
const CODEX_BACKEND_IMAGE_MODEL = "gpt-image-2";
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu;
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1e3;
const MAX_RETRY_DELAY_MS = 3e4;
const INSTRUCTIONS = "You are generating bitmap image assets. For this request, call the image_generation tool exactly once. Do not answer with only text unless image generation is unavailable.";
const CODEX_IMAGE_OUTPUT_FORMATS = [
	"png",
	"jpeg",
	"webp"
];
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Strip JWT-shaped secrets before an error message leaves the client. */
function redactSecrets(text) {
	return text.replace(JWT, "[REDACTED]").slice(0, 1e3);
}
function isRetryableStatus(status, errorText) {
	if ([
		429,
		500,
		502,
		503,
		504
	].includes(status)) return true;
	return /rate.?limit|overloaded|service.?unavailable|upstream.?connect|connection.?refused/iu.test(errorText);
}
function parseRetryAfter(value, nowMs = Date.now()) {
	if (value === null) return void 0;
	const trimmed = value.trim();
	if (/^\d+(?:\.\d+)?$/u.test(trimmed)) {
		const milliseconds = Number(trimmed) * 1e3;
		return Number.isFinite(milliseconds) ? Math.min(milliseconds, MAX_RETRY_DELAY_MS) : void 0;
	}
	const dateMs = Date.parse(trimmed);
	if (!Number.isFinite(dateMs) || dateMs <= nowMs) return void 0;
	return Math.min(dateMs - nowMs, MAX_RETRY_DELAY_MS);
}
function retryDelayMs(attempt, retryAfter, random = Math.random, nowMs = Date.now()) {
	const serverDelay = parseRetryAfter(retryAfter, nowMs);
	if (serverDelay !== void 0) return Math.floor(Math.min(serverDelay * (1 + random() * .1), MAX_RETRY_DELAY_MS));
	const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
	return Math.floor(exponential * (.9 + random() * .2));
}
function abortableDelay(milliseconds, signal) {
	if (signal?.aborted === true) return Promise.reject(/* @__PURE__ */ new Error("Image generation was aborted."));
	return new Promise((resolve, reject) => {
		const timer = setTimeout(finish, milliseconds);
		const abort = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", abort);
			reject(/* @__PURE__ */ new Error("Image generation was aborted."));
		};
		function finish() {
			clearTimeout(timer);
			signal?.removeEventListener("abort", abort);
			resolve();
		}
		signal?.addEventListener("abort", abort, { once: true });
	});
}
/** Build the hosted-tool Responses payload. tool_choice is always auto. */
function buildImageGenerationBody(model, prompt, outputFormat, sessionId, inputImages = []) {
	return {
		model,
		store: false,
		stream: true,
		prompt_cache_key: sessionId,
		instructions: INSTRUCTIONS,
		input: [{
			role: "user",
			content: [{
				type: "input_text",
				text: prompt
			}, ...inputImages.map((image) => ({
				type: "input_image",
				image_url: "data:" + image.mimeType + ";base64," + image.data
			}))]
		}],
		tools: [{
			type: "image_generation",
			output_format: outputFormat
		}],
		tool_choice: "auto",
		parallel_tool_calls: false,
		text: { verbosity: "low" }
	};
}
function parseSseDataLines(chunk) {
	const data = chunk.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n").trim();
	return data.length > 0 && data !== "[DONE]" ? data : void 0;
}
function handleCodexEvent(event, parsed) {
	if (!isRecord$1(event) || typeof event["type"] !== "string") return;
	switch (event["type"]) {
		case "error": {
			const message = typeof event["message"] === "string" ? event["message"] : typeof event["code"] === "string" ? event["code"] : JSON.stringify(event);
			throw new Error("Codex error: " + redactSecrets(message));
		}
		case "response.failed": {
			const response = isRecord$1(event["response"]) ? event["response"] : void 0;
			const error = response !== void 0 && isRecord$1(response["error"]) ? response["error"] : void 0;
			const message = error !== void 0 && typeof error["message"] === "string" ? error["message"] : "Codex response failed.";
			throw new Error(redactSecrets(message));
		}
		case "response.created": {
			const response = isRecord$1(event["response"]) ? event["response"] : void 0;
			if (response !== void 0 && typeof response["id"] === "string") parsed.responseId = response["id"];
			break;
		}
		case "response.output_text.delta":
			if (typeof event["delta"] === "string") parsed.text.push(event["delta"]);
			break;
		case "response.output_item.done": {
			const item = isRecord$1(event["item"]) ? event["item"] : void 0;
			if (item === void 0 || item["type"] !== "image_generation_call") break;
			if (typeof item["result"] !== "string" || item["result"].length === 0) throw new Error("Codex image_generation_call did not contain image data.");
			parsed.image = {
				id: typeof item["id"] === "string" && item["id"].length > 0 ? item["id"] : "image_generation",
				status: typeof item["status"] === "string" && item["status"].length > 0 ? item["status"] : "completed",
				result: item["result"],
				...typeof item["revised_prompt"] === "string" ? { revisedPrompt: item["revised_prompt"] } : {}
			};
			break;
		}
		case "response.completed": {
			const response = isRecord$1(event["response"]) ? event["response"] : void 0;
			if (response !== void 0 && typeof response["id"] === "string") parsed.responseId = response["id"];
			break;
		}
	}
}
async function parseCodexSse(response, signal) {
	if (response.body === null) throw new Error("Codex response did not include a stream body.");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const parsed = { text: [] };
	try {
		while (true) {
			if (signal?.aborted === true) throw new Error("Image generation was aborted.");
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let separator = buffer.indexOf("\n\n");
			while (separator !== -1) {
				const chunk = buffer.slice(0, separator);
				buffer = buffer.slice(separator + 2);
				const data = parseSseDataLines(chunk);
				if (data !== void 0) handleCodexEvent(JSON.parse(data), parsed);
				separator = buffer.indexOf("\n\n");
			}
		}
		const remaining = parseSseDataLines(buffer);
		if (remaining !== void 0) handleCodexEvent(JSON.parse(remaining), parsed);
	} finally {
		try {
			await reader.cancel();
		} catch {}
		reader.releaseLock();
	}
	return parsed;
}
/** Decode and sniff Codex image_generation_call base64 without a recursive regex. */
function decodeImageData(base64Data) {
	const value = base64Data.trim();
	if (value.length === 0) throw new Error("Codex returned invalid base64 image data.");
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (!(code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47 || code === 61)) throw new Error("Codex returned invalid base64 image data.");
	}
	const bytes = Buffer.from(value, "base64");
	if (bytes.length === 0) throw new Error("Codex returned invalid base64 image data.");
	if (mediaTypeOf(bytes) === void 0) throw new Error("Codex returned image data that is not PNG, JPEG, or WebP.");
	return bytes;
}
/** POST /codex/responses with hosted image_generation and parse the SSE image. */
async function requestCodexImage(request) {
	const body = JSON.stringify(buildImageGenerationBody(request.model, request.prompt, request.outputFormat, request.sessionId, request.inputImages ?? []));
	const headers = {
		authorization: "Bearer " + request.accessToken,
		"chatgpt-account-id": request.accountId,
		originator: CODEX_IMAGE_ORIGINATOR,
		"OpenAI-Beta": CODEX_IMAGE_BETA,
		accept: "text/event-stream",
		"content-type": "application/json"
	};
	const fetchImpl = request.fetchImpl ?? globalThis.fetch;
	const delay = request.retryDelayMs ?? retryDelayMs;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
		if (request.signal?.aborted === true) throw new Error("Image generation was aborted.");
		const response = await fetchImpl(CODEX_RESPONSES_URL, {
			method: "POST",
			redirect: "error",
			headers,
			body,
			...request.signal === void 0 ? {} : { signal: request.signal }
		});
		if (!response.ok) {
			const errorText = redactSecrets(await response.text());
			if (attempt < MAX_ATTEMPTS && isRetryableStatus(response.status, errorText)) {
				await abortableDelay(delay(attempt, response.headers.get("retry-after")), request.signal);
				continue;
			}
			const suffix = errorText.length > 0 ? ": " + errorText : "";
			const message = "Codex image generation request failed (HTTP " + String(response.status) + ")" + suffix;
			throw new Error(response.status === 401 || response.status === 403 ? message + "; sign in again" : message);
		}
		const parsed = await parseCodexSse(response, request.signal);
		if (parsed.image === void 0) {
			const text = parsed.text.join("").trim();
			throw new Error(text.length > 0 ? "Codex did not return an image. Response text: " + redactSecrets(text) : "Codex did not return an image.");
		}
		const bytes = decodeImageData(parsed.image.result);
		return {
			id: parsed.image.id,
			status: parsed.image.status,
			bytes,
			...parsed.image.revisedPrompt === void 0 ? {} : { revisedPrompt: parsed.image.revisedPrompt },
			...parsed.responseId === void 0 ? {} : { responseId: parsed.responseId }
		};
	}
	throw new Error("Codex image generation request failed after all retries.");
}
//#endregion
//#region lib/types/public-http.js
/** Public-network-only HTTP(S) reader used by the optional remote image path. */
const PUBLIC_HTTP_HOP_TIMEOUT_MS = 3e4;
function blockedList(family, ranges) {
	const list = new BlockList();
	for (const [address, prefix] of ranges) list.addSubnet(address, prefix, family);
	return list;
}
const FAKE_IP_IPV4 = blockedList("ipv4", [["198.18.0.0", 15]]);
const BLOCKED_IPV4 = blockedList("ipv4", [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.88.99.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4]
]);
const GLOBAL_IPV6 = blockedList("ipv6", [["2000::", 3]]);
const BLOCKED_IPV6 = blockedList("ipv6", [
	["2001::", 32],
	["2001:2::", 48],
	["2001:10::", 28],
	["2001:20::", 28],
	["2001:db8::", 32],
	["2002::", 16]
]);
function unbracket(hostname) {
	return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}
function isFakeIpNetworkAddress(rawAddress) {
	const address = unbracket(rawAddress);
	return isIP(address) === 4 && FAKE_IP_IPV4.check(address, "ipv4");
}
function isPublicNetworkAddress(rawAddress) {
	const address = unbracket(rawAddress);
	if (address.includes("%")) return false;
	const family = isIP(address);
	if (family === 4) return !BLOCKED_IPV4.check(address, "ipv4");
	if (family === 6) return GLOBAL_IPV6.check(address, "ipv6") && !BLOCKED_IPV6.check(address, "ipv6");
	return false;
}
function abortError(signal) {
	return signal.reason instanceof Error ? signal.reason : new Error(signal.reason === void 0 ? "remote image request aborted" : String(signal.reason));
}
function assertTargetUrl(url) {
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("view_image URL must use http or https");
	if (url.username !== "" || url.password !== "") throw new Error("view_image URL must not contain credentials");
}
function normalizeAddress(candidate) {
	if (candidate.family !== 4 && candidate.family !== 6) throw new Error("remote image hostname resolved to an unsupported address family");
	return {
		address: candidate.address,
		family: candidate.family
	};
}
const FAKE_IP_PROBE_HOSTS = ["example.com", "one.one.one.one"];
async function systemLookupAll(hostname) {
	return lookup(hostname, {
		all: true,
		order: "verbatim"
	});
}
async function verifyFakeIpProxyMode(lookup, signal) {
	try {
		for (const hostname of FAKE_IP_PROBE_HOSTS) {
			if (signal.aborted) throw abortError(signal);
			const addresses = await lookup(hostname);
			if (addresses.length === 0 || addresses.some((candidate) => !isFakeIpNetworkAddress(candidate.address))) return false;
		}
		return true;
	} catch (error) {
		if (signal.aborted) throw abortError(signal);
		return false;
	}
}
function resolveHostWith(lookup) {
	return async (hostname, signal) => {
		if (signal.aborted) throw abortError(signal);
		const literal = unbracket(hostname);
		const family = isIP(literal);
		if (family === 4 || family === 6) return [{
			address: literal,
			family
		}];
		const results = await lookup(literal);
		if (signal.aborted) throw abortError(signal);
		const addresses = results.map(normalizeAddress);
		if (addresses.length === 0 || addresses.some((candidate) => !isFakeIpNetworkAddress(candidate.address))) return addresses;
		if (!await verifyFakeIpProxyMode(lookup, signal)) return addresses;
		return addresses.map((candidate) => ({
			...candidate,
			viaVerifiedFakeIpProxy: true
		}));
	};
}
async function collectBoundedBytes(body, declaredLength, maxBytes, signal) {
	const declared = declaredLength === void 0 ? NaN : Number(declaredLength);
	if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`remote image exceeds ${String(maxBytes)} bytes`);
	const chunks = [];
	let total = 0;
	for await (const chunk of body) {
		if (signal.aborted) throw abortError(signal);
		const bytes = typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk);
		total += bytes.byteLength;
		if (total > maxBytes) throw new Error(`remote image exceeds ${String(maxBytes)} bytes`);
		chunks.push(bytes);
	}
	const data = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		data.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return data;
}
function pinnedLookup(address) {
	return (_hostname, options, callback) => {
		const resolved = {
			address: address.address,
			family: address.family
		};
		if (options.all === true) callback(null, [resolved]);
		else callback(null, resolved.address, resolved.family);
	};
}
function headerValue(message, name) {
	const value = message.headers[name];
	return Array.isArray(value) ? value[0] : value;
}
async function requestPinned(url, address, maxBytes, signal) {
	if (signal.aborted) throw abortError(signal);
	return new Promise((resolve, reject) => {
		let settled = false;
		let response;
		const finish = (result) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			if (result.ok) resolve(result.value);
			else reject(result.error);
		};
		const request$2 = (url.protocol === "https:" ? request$1 : request)(url, {
			method: "GET",
			agent: false,
			lookup: pinnedLookup(address),
			headers: { accept: "image/png, image/jpeg, image/webp, image/gif" }
		}, (incoming) => {
			response = incoming;
			const status = incoming.statusCode ?? 0;
			const location = headerValue(incoming, "location");
			if (status >= 300 && status < 400 || status < 200 || status >= 300) {
				finish({
					ok: true,
					value: {
						status,
						...location === void 0 ? {} : { location }
					}
				});
				incoming.destroy();
				return;
			}
			collectBoundedBytes(incoming, headerValue(incoming, "content-length"), maxBytes, signal).then((data) => {
				finish({
					ok: true,
					value: {
						status,
						data
					}
				});
			}, (error) => {
				incoming.destroy(error instanceof Error ? error : void 0);
				finish({
					ok: false,
					error
				});
			});
		});
		const onAbort = () => {
			const error = abortError(signal);
			response?.destroy(error);
			request$2.destroy(error);
		};
		const timer = setTimeout(() => {
			const error = /* @__PURE__ */ new Error(`remote image request exceeded ${String(PUBLIC_HTTP_HOP_TIMEOUT_MS)}ms`);
			response?.destroy(error);
			request$2.destroy(error);
		}, PUBLIC_HTTP_HOP_TIMEOUT_MS);
		timer.unref();
		signal.addEventListener("abort", onAbort, { once: true });
		request$2.once("error", (error) => {
			finish({
				ok: false,
				error
			});
		});
		request$2.end();
	});
}
function createNodePublicHttpRuntime(options = {}) {
	return {
		resolve: resolveHostWith(options.lookup ?? systemLookupAll),
		get: requestPinned
	};
}
const NODE_PUBLIC_HTTP_RUNTIME = createNodePublicHttpRuntime();
async function fetchPublicHttpResource(source, maxBytes, signal, runtime = NODE_PUBLIC_HTTP_RUNTIME) {
	let url = new URL(source);
	assertTargetUrl(url);
	for (let redirects = 0;; redirects += 1) {
		if (signal.aborted) throw abortError(signal);
		const addresses = await runtime.resolve(url.hostname, signal);
		const unsafe = addresses.some((candidate) => {
			if (isPublicNetworkAddress(candidate.address)) return false;
			return candidate.viaVerifiedFakeIpProxy !== true || !isFakeIpNetworkAddress(candidate.address);
		});
		if (addresses.length === 0 || unsafe) throw new Error(`remote image host ${JSON.stringify(url.hostname)} must resolve only to public network addresses`);
		const hop = await runtime.get(url, addresses[0], maxBytes, signal);
		if (hop.status >= 300 && hop.status < 400) {
			if (redirects >= 5) throw new Error(`remote image exceeded ${String(5)} redirects`);
			if (hop.location === void 0) throw new Error(`remote image redirect ${String(hop.status)} has no location`);
			url = new URL(hop.location, url);
			assertTargetUrl(url);
			continue;
		}
		if (hop.status < 200 || hop.status >= 300) throw new Error(`remote image request failed with HTTP ${String(hop.status)}`);
		if (hop.data === void 0) throw new Error("remote image response did not contain a body");
		const name = basename(url.pathname) || void 0;
		return {
			data: hop.data,
			display: url.href,
			...name === void 0 ? {} : { name }
		};
	}
}
//#endregion
//#region lib/types/generate-image.js
/** Model-invoked `codex_generate_image` tool over ChatGPT Codex OAuth. */
const GENERATE_IMAGE_TOOL_NAME = "codex_generate_image";
function refOf$1(image) {
	return {
		attachmentId: AttachmentId(image.attachmentId),
		mediaType: image.mediaType,
		bytes: image.bytes,
		width: image.width,
		height: image.height,
		...image.name === void 0 ? {} : { name: image.name }
	};
}
function contentOf$1(value) {
	const lines = [
		"<path>" + value.path + "</path>",
		"<image>" + value.image.mediaType + ", " + String(value.image.width) + "x" + String(value.image.height) + " px, " + String(value.image.bytes) + " bytes</image>",
		"<backend>" + value.backendImageModel + " via " + value.routingModel + "</backend>"
	];
	if (value.revisedPrompt !== void 0) lines.push("<revised_prompt>" + value.revisedPrompt + "</revised_prompt>");
	if (value.saveWarning !== void 0) lines.push("<warning>" + value.saveWarning + "</warning>");
	return [{
		type: "text",
		text: lines.join("\n")
	}, {
		type: "image",
		attachment: refOf$1(value.image)
	}];
}
function extensionOf(format) {
	return format === "jpeg" ? "jpg" : format;
}
function sanitizeFilePart(value) {
	const cleaned = value.replace(/[^a-zA-Z0-9_-]+/gu, "_").replace(/^_+|_+$/gu, "");
	return cleaned.length > 0 ? cleaned.slice(0, 80) : "image";
}
/** Models often send "" for omitted optional strings. Treat blank as absent. */
function optionalText(value) {
	if (value === void 0) return void 0;
	const trimmed = value.trim();
	return trimmed.length === 0 ? void 0 : trimmed;
}
function resolveImageGenerationRoutingModel(model) {
	const trimmed = model.trim();
	if (trimmed.length === 0) throw new Error("codex_generate_image has no routing model; choose a vision-capable official Codex model in Plugin configuration");
	const wireId = parseCodexPickerId(trimmed).wireId;
	const official = officialModelFor(wireId);
	if (official !== void 0 && official.vision === false) throw new Error("codex_generate_image cannot use \"" + trimmed + "\": that Codex model does not declare image input. Choose a vision-capable official model in Plugin configuration.");
	return wireId;
}
async function loadSource(ctx, exec, source, maxBytes) {
	const trimmed = source.trim();
	if (trimmed.length === 0) throw new Error("codex_generate_image source must not be empty");
	let data;
	if (/^https?:\/\//iu.test(trimmed)) data = (await fetchPublicHttpResource(trimmed, maxBytes, exec.signal)).data;
	else {
		const cwd = exec.agent?.session.header.cwd;
		const target = await ctx.fs.resolve(trimmed, {
			...cwd === void 0 ? {} : { cwd },
			signal: exec.signal
		});
		const info = await ctx.fs.stat(target, exec.signal);
		if (info === void 0) throw new Error("image path does not exist: " + trimmed);
		if (info.type !== "file") throw new Error("image path is not a regular file: " + trimmed);
		data = await ctx.fs.readBytes(target, exec.signal, maxBytes);
		ctx.emit("fs/observed", target, {
			kind: "present",
			version: info.version
		}, exec);
	}
	const mediaType = mediaTypeOf(data);
	if (mediaType === void 0) throw new Error("codex_generate_image source must be PNG, JPEG, WebP, or GIF");
	return {
		data: Buffer.from(data).toString("base64"),
		mimeType: mediaType
	};
}
async function writeGeneratedFile(ctx, exec, relativePath, bytes) {
	const cwd = exec.agent?.session.header.cwd;
	const target = await ctx.fs.resolve(relativePath, {
		...cwd === void 0 ? {} : { cwd },
		signal: exec.signal
	});
	const processPath = ctx.fs.processPath(target);
	await mkdir(dirname(processPath), { recursive: true });
	await writeFile(processPath, bytes);
	const info = await ctx.fs.stat(target, exec.signal);
	if (info !== void 0) ctx.emit("fs/observed", target, {
		kind: "present",
		version: info.version
	}, exec);
	return target.displayPath;
}
function generateImageTool(ctx, options) {
	return defineTool({
		name: GENERATE_IMAGE_TOOL_NAME,
		description: "Generate or edit a raster image with ChatGPT Codex (gpt-image-2 on the Codex subscription). Uses the plugin's ChatGPT login; consumes Codex usage (typically 3-5x a text turn). Distinct from other providers' generate_image tools. For a new image, pass only prompt (and optional path). Omit source; never send an empty source string. Do not call unless the user asked for a bitmap image.",
		parameters: {
			prompt: {
				type: "string",
				required: true,
				description: "Image prompt. Be specific about subject, composition, style, text, and constraints."
			},
			path: {
				type: "string",
				description: "Workspace-relative destination. Defaults to generated-images/<id>.<ext> under the session cwd."
			},
			outputFormat: {
				type: "string",
				enum: [...CODEX_IMAGE_OUTPUT_FORMATS],
				description: "png (default), jpeg, or webp."
			},
			source: {
				type: "string",
				description: "Local path or http(s) URL of one reference image to edit. Omit this field entirely for a new image. Do not pass an empty string."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					path: {
						type: "string",
						required: true
					},
					prompt: {
						type: "string",
						required: true
					},
					revisedPrompt: { type: "string" },
					routingModel: {
						type: "string",
						required: true
					},
					backendImageModel: {
						type: "string",
						required: true
					},
					saveWarning: { type: "string" },
					image: {
						type: "object",
						required: true,
						additionalProperties: false,
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								required: true,
								enum: [
									"image/png",
									"image/jpeg",
									"image/webp",
									"image/gif"
								]
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" }
						}
					}
				}
			},
			render: (_args, value) => contentOf$1(value)
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const prompt = args.prompt.trim();
			if (prompt.length === 0) throw new Error("codex_generate_image prompt must not be empty");
			const outputFormat = args.outputFormat ?? "png";
			const routingModel = resolveImageGenerationRoutingModel(options.routingModel());
			const accessToken = await options.resolveAccessToken();
			const accountId = chatgptAccountIdFromToken(accessToken);
			const attachments = ctx.attachments;
			const maxBytes = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes);
			const source = optionalText(args.source);
			const inputImages = source === void 0 ? [] : [await loadSource(ctx, exec, source, maxBytes)];
			const generated = await requestCodexImage({
				accessToken,
				accountId,
				model: routingModel,
				prompt,
				outputFormat,
				sessionId: typeof exec.agent?.session.id === "string" && exec.agent.session.id.length > 0 ? exec.agent.session.id : String(exec.callId),
				inputImages,
				signal: exec.signal,
				...options.fetchImpl === void 0 ? {} : { fetchImpl: options.fetchImpl },
				...options.retryDelayMs === void 0 ? {} : { retryDelayMs: options.retryDelayMs }
			});
			const mediaType = mediaTypeOf(generated.bytes);
			if (mediaType === void 0) throw new Error("Codex returned image data that is not PNG, JPEG, or WebP.");
			if (!attachments.imageLimits.mediaTypes.includes(mediaType)) throw new Error(mediaType + " images are disabled by this deployment");
			const defaultName = sanitizeFilePart(generated.id) + "." + extensionOf(outputFormat);
			const relativePath = args.path === void 0 || args.path.trim().length === 0 ? "generated-images/" + defaultName : args.path.trim();
			const ref = await attachments.saveImage({
				data: generated.bytes,
				mediaType,
				name: basename(relativePath)
			});
			let path = relativePath;
			let saveWarning;
			try {
				path = await writeGeneratedFile(ctx, exec, relativePath, generated.bytes);
			} catch (error) {
				saveWarning = "Image generation succeeded, but the image could not be saved to disk: " + (error instanceof Error && error.message.length > 0 ? error.message : String(error));
			}
			const value = {
				path,
				prompt,
				routingModel,
				backendImageModel: CODEX_BACKEND_IMAGE_MODEL,
				image: {
					attachmentId: ref.attachmentId,
					mediaType: ref.mediaType,
					bytes: ref.bytes,
					width: ref.width,
					height: ref.height,
					...ref.name === void 0 ? {} : { name: ref.name }
				},
				...generated.revisedPrompt === void 0 ? {} : { revisedPrompt: generated.revisedPrompt },
				...saveWarning === void 0 ? {} : { saveWarning }
			};
			if (exec.parent !== void 0) exec.deferContext(createUserMessage({
				content: contentOf$1(value),
				source: {
					kind: "plugin",
					plugin: "dsh-llm-codex"
				}
			}));
			return value;
		},
		presentCall: (args) => ({
			card: "generic",
			title: "Codex image: " + args.prompt,
			kind: "other",
			rawInput: args.prompt,
			...args.path === void 0 || args.path.trim().length === 0 ? {} : { locations: [{ path: args.path }] }
		})
	});
}
//#endregion
//#region lib/types/view-image.js
/** Codex-compatible `view_image` tool for local paths and HTTP(S) URLs. */
const VIEW_IMAGE_TOOL_NAME = "view_image";
function refOf(image) {
	return {
		attachmentId: AttachmentId(image.attachmentId),
		mediaType: image.mediaType,
		bytes: image.bytes,
		width: image.width,
		height: image.height,
		...image.name === void 0 ? {} : { name: image.name }
	};
}
function contentOf(value) {
	return [{
		type: "text",
		text: `<source>${value.source}</source>\n<image>${value.image.mediaType}, ${value.image.width}x${value.image.height} px, ${value.image.bytes} bytes</image>`
	}, {
		type: "image",
		attachment: refOf(value.image)
	}];
}
async function assertImageCapable(ctx, exec, source) {
	const configured = exec.agent?.session.requestHeader()?.config;
	const provider = configured?.provider ?? exec.agent?.options.provider;
	const model = configured?.model ?? exec.agent?.options.model;
	if (provider === void 0 || model === void 0) throw new Error(`cannot view ${JSON.stringify(source)}: the current model route is unavailable`);
	const info = await ctx.llm.resolveModelInfo(provider, model, exec.signal);
	if (info.inputModalities === void 0 || !info.inputModalities.includes("image")) throw new Error(`cannot view ${JSON.stringify(source)}: model "${model}" does not declare image input`);
}
function viewImageTool(ctx) {
	return defineTool({
		name: VIEW_IMAGE_TOOL_NAME,
		description: "View an image from a local file path or an http(s) URL. Returns the actual PNG, JPEG, WebP, or GIF image to vision-capable models.",
		parameters: { source: {
			type: "string",
			required: true,
			description: "Local absolute/relative image path, or an http(s) image URL."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					source: {
						type: "string",
						required: true
					},
					image: {
						type: "object",
						required: true,
						additionalProperties: false,
						properties: {
							attachmentId: {
								type: "string",
								required: true
							},
							mediaType: {
								type: "string",
								required: true,
								enum: [
									"image/png",
									"image/jpeg",
									"image/webp",
									"image/gif"
								]
							},
							bytes: {
								type: "integer",
								required: true
							},
							width: {
								type: "integer",
								required: true
							},
							height: {
								type: "integer",
								required: true
							},
							name: { type: "string" }
						}
					}
				}
			},
			render: (_args, value) => contentOf(value)
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const source = args.source.trim();
			if (source.length === 0) throw new Error("view_image source must not be empty");
			await assertImageCapable(ctx, exec, source);
			const attachments = ctx.attachments;
			const maxBytes = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes);
			let loaded;
			if (/^https?:\/\//iu.test(source)) loaded = await fetchPublicHttpResource(source, maxBytes, exec.signal);
			else {
				const cwd = exec.agent?.session.header.cwd;
				const target = await ctx.fs.resolve(source, {
					...cwd === void 0 ? {} : { cwd },
					signal: exec.signal
				});
				const info = await ctx.fs.stat(target, exec.signal);
				if (info === void 0) throw new Error(`image path does not exist: ${source}`);
				if (info.type !== "file") throw new Error(`image path is not a regular file: ${source}`);
				loaded = {
					data: await ctx.fs.readBytes(target, exec.signal, maxBytes),
					display: target.displayPath,
					name: basename(target.displayPath)
				};
				ctx.emit("fs/observed", target, {
					kind: "present",
					version: info.version
				}, exec);
			}
			const mediaType = mediaTypeOf(loaded.data);
			if (mediaType === void 0) throw new Error("view_image supports PNG, JPEG, WebP, and GIF image bytes");
			if (!attachments.imageLimits.mediaTypes.includes(mediaType)) throw new Error(`${mediaType} images are disabled by this deployment`);
			const ref = await attachments.saveImage({
				data: loaded.data,
				mediaType,
				...loaded.name === void 0 ? {} : { name: loaded.name }
			});
			const value = {
				source: loaded.display,
				image: {
					attachmentId: ref.attachmentId,
					mediaType: ref.mediaType,
					bytes: ref.bytes,
					width: ref.width,
					height: ref.height,
					...ref.name === void 0 ? {} : { name: ref.name }
				}
			};
			if (exec.parent !== void 0) exec.deferContext(createUserMessage({
				content: contentOf(value),
				source: {
					kind: "plugin",
					plugin: "dsh-llm-codex"
				}
			}));
			return value;
		},
		presentCall: (args) => ({
			card: "generic",
			title: `View image ${args.source}`,
			kind: /^https?:\/\//iu.test(args.source) ? "fetch" : "read",
			.../^https?:\/\//iu.test(args.source) ? { rawInput: args.source } : { locations: [{ path: args.source }] }
		})
	});
}
//#endregion
//#region lib/types/remote-catalog.js
/** Authenticated Codex model discovery with a DSH-local fallback cache. */
const CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models";
const CODEX_MODEL_CACHE_FILENAME = "codex-models.json";
const CACHE_FORMAT_VERSION = 1;
const REQUEST_TIMEOUT_MS = 15e3;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function positiveInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function strings(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => typeof item === "string" && item.length > 0);
}
function reasoningEfforts(value) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (!isRecord(item) || typeof item["effort"] !== "string" || item["effort"].length === 0) return [];
		return [item["effort"]];
	});
}
function remoteRows(value) {
	if (!isRecord(value) || !Array.isArray(value["models"])) throw new Error("Codex returned an invalid model catalog");
	return value["models"].flatMap((entry) => {
		if (!isRecord(entry) || entry["visibility"] !== "list" || entry["supported_in_api"] !== true || typeof entry["slug"] !== "string" || entry["slug"].length === 0) return [];
		const id = entry["slug"];
		const name = typeof entry["display_name"] === "string" && entry["display_name"].length > 0 ? entry["display_name"] : id;
		const efforts = reasoningEfforts(entry["supported_reasoning_levels"]);
		const modalities = strings(entry["input_modalities"]);
		const contextWindow = positiveInteger(entry["context_window"]);
		const maxTokens = positiveInteger(entry["max_output_tokens"]);
		const model = {
			id,
			name,
			...typeof entry["description"] === "string" && entry["description"].length > 0 ? { description: entry["description"] } : {},
			...contextWindow === void 0 ? {} : { contextWindow },
			...maxTokens === void 0 ? {} : { maxTokens },
			thinking: efforts.length > 0,
			...efforts.length === 0 ? {} : { efforts },
			...typeof entry["default_reasoning_level"] === "string" ? { defaultEffort: entry["default_reasoning_level"] } : {},
			vision: modalities.includes("image"),
			tools: true
		};
		return strings(entry["additional_speed_tiers"]).includes("fast") || Array.isArray(entry["service_tiers"]) && entry["service_tiers"].some((tier) => isRecord(tier) && tier["id"] === "priority") ? [model, {
			...model,
			id: id + "-fast",
			name: name + " Fast",
			fast: true
		}] : [model];
	});
}
function mergeCatalog(primary, fallback) {
	const merged = /* @__PURE__ */ new Map();
	for (const model of [...primary, ...fallback]) if (!merged.has(model.id)) merged.set(model.id, model);
	return [...merged.values()];
}
function cachePath(store) {
	return join(dirname(store.filename), CODEX_MODEL_CACHE_FILENAME);
}
async function readCache(filename) {
	let value;
	try {
		value = JSON.parse(await readFile(filename, "utf8"));
	} catch {
		return;
	}
	if (!isRecord(value) || value["version"] !== CACHE_FORMAT_VERSION || !Array.isArray(value["models"])) return void 0;
	const models = value["models"].map(decodeCodexCatalogModel);
	return models.every((model) => model !== void 0) ? models : void 0;
}
async function fetchRemoteCatalog(store, request) {
	const access = await resolveCodexAccessToken(store);
	const credential = await store.read(OPENAI_CODEX_PROVIDER);
	const accountId = credential?.type === "oauth" ? credential.accountId : void 0;
	if (typeof accountId !== "string" || accountId.length === 0) throw new Error("Codex authorization is unavailable");
	const response = await request("https://chatgpt.com/backend-api/codex/models?client_version=0.0.0", {
		method: "GET",
		redirect: "error",
		headers: {
			authorization: "Bearer " + access,
			"chatgpt-account-id": accountId,
			accept: "application/json",
			originator: "deepseek-harness"
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	});
	const payload = await response.json();
	if (!response.ok) throw new Error("Codex model refresh failed (HTTP " + String(response.status) + ")");
	return remoteRows(payload);
}
/** Fetch the live catalog, persist it locally, and fall back to the last known/static rows offline. */
async function refreshCodexModelCatalog(store, request = fetch) {
	const filename = cachePath(store);
	const fallback = mergeCatalog(await readCache(filename) ?? [], officialPickerCatalog());
	let remote;
	try {
		remote = await fetchRemoteCatalog(store, request);
	} catch {
		return fallback;
	}
	const models = mergeCatalog(remote, officialPickerCatalog());
	try {
		await writeFileAtomic(filename, JSON.stringify({
			version: CACHE_FORMAT_VERSION,
			models
		}, null, 2) + "\n", {
			mode: 384,
			dirMode: 448
		});
	} catch {}
	return models;
}
//#endregion
//#region lib/types/model-switch-adapter.js
function generatedValue(value) {
	if (typeof value !== "object" || value === null) throw new Error("Codex image adapter returned no metadata");
	const result = value;
	if (typeof result.path !== "string" || typeof result.image !== "object" || result.image === null) throw new Error("Codex image adapter returned invalid metadata");
	const image = result.image;
	if (typeof image.attachmentId !== "string" || typeof image.mediaType !== "string" || typeof image.bytes !== "number" || typeof image.width !== "number" || typeof image.height !== "number") throw new Error("Codex image adapter returned invalid image metadata");
	return result;
}
function normalize(value) {
	return {
		path: value.path,
		mediaType: value.image.mediaType,
		width: value.image.width,
		height: value.image.height,
		bytes: value.image.bytes,
		attachmentId: value.image.attachmentId,
		...value.image.name === void 0 ? {} : { name: value.image.name },
		...value.revisedPrompt === void 0 ? {} : { revisedPrompt: value.revisedPrompt }
	};
}
/** Optional Search/Image integration; standalone Codex behavior is unchanged when Model Switch is absent. */
function installCodexModelSwitchAdapters(ctx, credentials, settings) {
	let imageContext;
	ctx.inject(["attachments", "fs"], (scope) => {
		imageContext = scope;
		return () => {
			if (imageContext === scope) imageContext = void 0;
		};
	});
	const adapters = {
		provider: "codex",
		search: {
			provider: "codex",
			supportsModel: (model) => settings()?.models.some((candidate) => candidate.id === model && candidate.tools !== false) === true,
			async search(model, request, signal) {
				const current = settings();
				if (current === void 0) throw new Error("Codex settings are unavailable");
				return new CodexSearchProvider({
					credentials,
					model,
					mode: current.searchMode,
					contextSize: current.searchContextSize,
					maxOutputTokens: current.searchMaxOutputTokens,
					resolveRequestId: randomUUID
				}).search(request, signal);
			}
		},
		image: {
			provider: "codex",
			supportsModel: (model) => imageContext !== void 0 && settings()?.models.some((candidate) => candidate.id === model && candidate.vision !== false) === true,
			async generate(model, request, execution) {
				if (typeof execution !== "object" || execution === null) throw new Error("image adapter requires public ToolRunContext");
				const toolExecution = execution;
				if (imageContext === void 0) throw new Error("Codex image adapter requires attachments and fs");
				return normalize(generatedValue(await generateImageTool(imageContext, {
					resolveAccessToken: () => resolveCodexAccessToken(credentials),
					routingModel: () => model
				}).execute(request, toolExecution)));
			}
		}
	};
	ctx.inject(["modelSwitch"], (scope) => scope.effect(() => scope.modelSwitch.adapters.register(adapters), "Model Switch: register Codex Search/Image adapters"));
}
//#endregion
//#region lib/types/index.js
/**
* Register the `codex` provider, ChatGPT OAuth, sortable catalog, and
* optional search / view_image / codex_generate_image capabilities.
* @module dsh-llm-codex
*/
/** Preserve Codex's historical normal retry count across host-line default changes. */
const DEFAULT_MAX_RETRIES = 2;
function withAuthRetries(policy) {
	if (policy.mode !== "normal") return policy;
	if (policy.retryableCodes.includes("AUTH")) return policy;
	return {
		...policy,
		retryableCodes: Object.freeze([...policy.retryableCodes, "AUTH"])
	};
}
const name = "llm-codex";
const inject = ["llm"];
const NS = CODEX_SETTINGS_NAMESPACE;
const catalogModel = z.object({
	id: z.string().required(),
	name: z.string(),
	description: z.string(),
	contextWindow: z.number().step(1).min(1),
	maxTokens: z.number().step(1).min(1),
	vision: z.boolean(),
	thinking: z.boolean(),
	defaultEffort: z.string(),
	efforts: z.array(z.string()),
	tools: z.boolean(),
	fast: z.boolean()
});
const Config = z.object({
	streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS),
	models: z.array(catalogModel),
	enableSearch: z.boolean().default(false),
	enableImageTool: z.boolean().default(false),
	enableImageGeneration: z.boolean().default(false),
	searchModel: z.string().default(DEFAULT_CODEX_SEARCH_MODEL),
	imageGenerationModel: z.string().default(DEFAULT_CODEX_IMAGE_GENERATION_MODEL),
	searchMode: z.union([
		"cached",
		"indexed",
		"live"
	]).default(DEFAULT_CODEX_SEARCH_MODE),
	searchContextSize: z.union([
		"low",
		"medium",
		"high"
	]).default(DEFAULT_CODEX_SEARCH_CONTEXT_SIZE),
	searchMaxOutputTokens: z.number().step(1).min(1).default(DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS),
	retryPolicy: RetryPolicySchema,
	registerLegacyTools: z.boolean().default(true)
});
function resolveModels(models) {
	const seen = /* @__PURE__ */ new Set();
	return (models ?? CODEX_CATALOG).map((model) => {
		if (model.id.length === 0) throw new Error("llm-codex: catalog model ids must be non-empty");
		if (model.name !== void 0 && model.name.length === 0) throw new Error(`llm-codex: catalog model "${model.id}" has an empty name`);
		if (seen.has(model.id)) throw new Error(`llm-codex: duplicate catalog model "${model.id}"`);
		seen.add(model.id);
		return hydrateCatalogModel(model);
	});
}
function resolveAdapterOptions(config) {
	const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? 3e5;
	if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) throw new Error(`llm-codex: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	return {
		models: resolveModels(config.models),
		streamIdleTimeoutMs,
		retryPolicy: withAuthRetries(resolveRetryPolicy(config.retryPolicy ?? {
			mode: "normal",
			maxRetries: DEFAULT_MAX_RETRIES
		}, "llm-codex: retryPolicy"))
	};
}
function internalError(message) {
	return {
		ok: false,
		error: {
			code: "internal",
			message,
			details: {}
		}
	};
}
async function saveConfiguration(ctx, payload) {
	const request = decodeCodexSaveRequest(payload);
	if (request === void 0) return internalError("invalid Codex settings request");
	const settings = ctx.get("settings");
	if (settings === void 0) return internalError("Codex settings are unavailable");
	try {
		const before = settings.describe().find((descriptor) => descriptor.ns === NS);
		if (before === void 0) return internalError("Codex settings are unavailable");
		const current = decodeCodexSettings(before.value);
		if (current === void 0) return internalError("Codex settings are invalid");
		const ops = [];
		if (!deepEqualJson(current.models, request.models)) ops.push({
			op: "set",
			path: ["models"],
			value: request.models
		});
		if (current.enableSearch !== request.enableSearch) ops.push({
			op: "set",
			path: ["enableSearch"],
			value: request.enableSearch
		});
		if (current.enableImageTool !== request.enableImageTool) ops.push({
			op: "set",
			path: ["enableImageTool"],
			value: request.enableImageTool
		});
		if (current.enableImageGeneration !== request.enableImageGeneration) ops.push({
			op: "set",
			path: ["enableImageGeneration"],
			value: request.enableImageGeneration
		});
		if (current.searchModel !== request.searchModel) ops.push({
			op: "set",
			path: ["searchModel"],
			value: request.searchModel
		});
		if (current.imageGenerationModel !== request.imageGenerationModel) ops.push({
			op: "set",
			path: ["imageGenerationModel"],
			value: request.imageGenerationModel
		});
		if (current.searchMode !== request.searchMode) ops.push({
			op: "set",
			path: ["searchMode"],
			value: request.searchMode
		});
		if (current.searchContextSize !== request.searchContextSize) ops.push({
			op: "set",
			path: ["searchContextSize"],
			value: request.searchContextSize
		});
		if (current.searchMaxOutputTokens !== request.searchMaxOutputTokens) ops.push({
			op: "set",
			path: ["searchMaxOutputTokens"],
			value: request.searchMaxOutputTokens
		});
		if (ops.length > 0) await settings.mutate(NS, ops, request.expectedRevision);
		const accepted = settings.describe().find((descriptor) => descriptor.ns === NS);
		const acceptedSettings = decodeCodexSettings(accepted?.value);
		if (accepted === void 0 || acceptedSettings === void 0) return internalError("Codex settings could not be reloaded");
		return {
			ok: true,
			value: {
				settings: acceptedSettings,
				revision: accepted.revision
			}
		};
	} catch (error) {
		return internalError(error instanceof Error && error.message.length > 0 ? error.message : "Codex settings save failed");
	}
}
async function readConfiguration(ctx) {
	const descriptor = ctx.get("settings")?.describe().find((item) => item.ns === NS);
	const settings = decodeCodexSettings(descriptor?.value);
	return descriptor === void 0 || settings === void 0 ? internalError("Codex settings are unavailable") : {
		ok: true,
		value: {
			settings,
			revision: descriptor.revision
		}
	};
}
function createCodexRpcHandler(ctx) {
	return async (endpoint, payload) => {
		if (endpoint === "settings/save") return saveConfiguration(ctx, payload);
		if (endpoint === "settings/read") return readConfiguration(ctx);
		return internalError(`unknown Codex endpoint: ${endpoint}`);
	};
}
function createCodexManagementRpcHandler(ctx, auth, fetchModels = async () => CODEX_CATALOG) {
	return async (endpoint, payload) => {
		if (endpoint === "settings/read") return readConfiguration(ctx);
		if (endpoint === "models/fetch") return {
			ok: true,
			value: await fetchModels()
		};
		if (endpoint === "settings/save") return saveConfiguration(ctx, payload);
		if (endpoint === "auth/status") {
			const refresh = typeof payload === "object" && payload !== null && payload.refresh === true;
			return {
				ok: true,
				value: await auth.status(refresh)
			};
		}
		if (endpoint === "auth/begin") {
			const method = typeof payload === "object" && payload !== null && payload.method === "device_code" ? "device_code" : "browser";
			return {
				ok: true,
				value: await auth.signIn(method)
			};
		}
		if (endpoint === "auth/attempt-status") {
			const attemptId = typeof payload === "object" && payload !== null && typeof payload.attemptId === "string" ? payload.attemptId : "";
			return {
				ok: true,
				value: { status: auth.attemptStatus(attemptId) }
			};
		}
		if (endpoint === "auth/cancel") {
			const attemptId = typeof payload === "object" && payload !== null && typeof payload.attemptId === "string" ? payload.attemptId : void 0;
			if (!auth.cancel(attemptId)) return internalError("stale Codex sign-in attempt");
			return {
				ok: true,
				value: { ok: true }
			};
		}
		if (endpoint === "auth/logout") {
			await auth.signOut();
			return {
				ok: true,
				value: { ok: true }
			};
		}
		return internalError(`unknown Codex endpoint: ${endpoint}`);
	};
}
function apply(ctx, config) {
	if (!allowDshRuntime(ctx.logger, "dsh-llm-codex", ["@deepseek-ai/dsh-llm"])) return;
	let current = () => config;
	let lastRaw;
	let lastGood;
	const options = () => {
		const raw = current();
		if (raw === lastRaw && lastGood !== void 0) return lastGood;
		try {
			const next = resolveAdapterOptions(raw);
			lastRaw = raw;
			lastGood = next;
			return next;
		} catch (error) {
			if (lastGood === void 0) throw error;
			lastRaw = raw;
			ctx.logger.error("llm-codex: keeping the last good configuration after an invalid settings section");
			ctx.logger.error(error);
			return lastGood;
		}
	};
	options();
	const credentials = new CodexCredentialStore();
	const auth = new CodexWebAuth(credentials);
	const adapter = new CodexAdapter({
		options,
		resolveApiKey: () => resolveCodexAccessToken(credentials),
		refreshApiKey: () => refreshCodexAccessToken(credentials),
		resolveAttachments: () => ctx.get("attachments")
	});
	ctx.llm.registerConfigurableProviders([{
		provider: CODEX_PROVIDER,
		displayName: "Codex",
		settingsNs: NS,
		settingsPath: []
	}]);
	const registration = ctx.llm.registerAdapter([CODEX_PROVIDER], adapter);
	let registeredPolicy = options().retryPolicy;
	const ensureRegistrationFacts = () => {
		lastRaw = void 0;
		const policy = options().retryPolicy;
		if (deepEqualJson(policy, registeredPolicy)) return;
		registration.replace([CODEX_PROVIDER]);
		registeredPolicy = policy;
	};
	ctx.inject(["webServer"], (webCtx) => registerCodexAuthRoutes(webCtx, credentials, auth));
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.effect(() => connectionCtx.connection.rpc.handle(CODEX_RPC_CHANNEL, createCodexManagementRpcHandler(ctx, auth, () => refreshCodexModelCatalog(credentials))), "dsh-llm-codex: management RPC");
	});
	let stopped = false;
	let searchFiber;
	let searchRegistration;
	let searchTail = Promise.resolve();
	let imageFiber;
	let imageTail = Promise.resolve();
	let generateFiber;
	let generateTail = Promise.resolve();
	const resolvedSettings = () => {
		return decodeCodexSettings({
			...DEFAULT_CODEX_SETTINGS,
			...current()
		});
	};
	installCodexModelSwitchAdapters(ctx, credentials, resolvedSettings);
	const reconcileSearch = async () => {
		if (stopped) return;
		const resolved = resolvedSettings();
		if (resolved === void 0) return;
		const nextRegistration = current().registerLegacyTools !== false && resolved.enableSearch ? {
			model: resolved.searchModel,
			mode: resolved.searchMode,
			contextSize: resolved.searchContextSize,
			maxOutputTokens: resolved.searchMaxOutputTokens
		} : void 0;
		if (deepEqualJson(nextRegistration, searchRegistration)) return;
		const previous = searchFiber;
		searchFiber = void 0;
		searchRegistration = void 0;
		if (previous !== void 0) await previous.dispose();
		if (stopped || nextRegistration === void 0) return;
		const fiber = ctx.inject(["web"], (webCtx) => webCtx.web.registerSearchProvider(new CodexSearchProvider({
			credentials,
			model: nextRegistration.model,
			mode: nextRegistration.mode,
			contextSize: nextRegistration.contextSize,
			maxOutputTokens: nextRegistration.maxOutputTokens,
			resolveRequestId: () => String(webCtx.get("agents")?.currentInitiator()?.session.id ?? randomUUID())
		})));
		searchFiber = fiber;
		searchRegistration = nextRegistration;
		Promise.resolve(fiber).catch((error) => {
			if (searchFiber === fiber) {
				searchFiber = void 0;
				searchRegistration = void 0;
			}
			ctx.logger.error("dsh-llm-codex: optional search provider failed to activate");
			ctx.logger.error(error);
		});
	};
	const reconcileImageTool = async () => {
		if (stopped) return;
		const resolved = resolvedSettings();
		const enabled = current().registerLegacyTools !== false && resolved?.enableImageTool === true;
		if (enabled === (imageFiber !== void 0)) return;
		const previous = imageFiber;
		imageFiber = void 0;
		if (previous !== void 0) await previous.dispose();
		if (stopped || !enabled) return;
		const fiber = ctx.inject([
			"tools",
			"fs",
			"attachments"
		], (toolCtx) => toolCtx.tools.register(viewImageTool(toolCtx)));
		imageFiber = fiber;
		Promise.resolve(fiber).catch((error) => {
			if (imageFiber === fiber) imageFiber = void 0;
			ctx.logger.error("dsh-llm-codex: optional view_image tool failed to activate");
			ctx.logger.error(error);
		});
	};
	const reconcileGenerateImage = async () => {
		if (stopped) return;
		const resolved = resolvedSettings();
		const enabled = current().registerLegacyTools !== false && resolved?.enableImageGeneration === true;
		if (enabled === (generateFiber !== void 0)) return;
		const previous = generateFiber;
		generateFiber = void 0;
		if (previous !== void 0) await previous.dispose();
		if (stopped || !enabled) return;
		const fiber = ctx.inject([
			"tools",
			"fs",
			"attachments"
		], (toolCtx) => toolCtx.tools.register(generateImageTool(toolCtx, {
			resolveAccessToken: () => resolveCodexAccessToken(credentials),
			routingModel: () => resolvedSettings()?.imageGenerationModel ?? "gpt-5.6-luna"
		})));
		generateFiber = fiber;
		Promise.resolve(fiber).catch((error) => {
			if (generateFiber === fiber) generateFiber = void 0;
			ctx.logger.error("dsh-llm-codex: optional codex_generate_image tool failed to activate");
			ctx.logger.error(error);
		});
	};
	const scheduleCapabilities = () => {
		ensureRegistrationFacts();
		searchTail = searchTail.then(reconcileSearch, reconcileSearch).catch((error) => {
			ctx.logger.error("dsh-llm-codex: could not apply the updated search configuration");
			ctx.logger.error(error);
		});
		imageTail = imageTail.then(reconcileImageTool, reconcileImageTool).catch((error) => {
			ctx.logger.error("dsh-llm-codex: could not apply the updated image-tool configuration");
			ctx.logger.error(error);
		});
		generateTail = generateTail.then(reconcileGenerateImage, reconcileGenerateImage).catch((error) => {
			ctx.logger.error("dsh-llm-codex: could not apply the updated image-generation configuration");
			ctx.logger.error(error);
		});
	};
	ctx.effect(() => async () => {
		stopped = true;
		let primaryFailed = false;
		let primaryError;
		try {
			await Promise.all([
				searchTail,
				imageTail,
				generateTail
			]);
		} catch (error) {
			primaryFailed = true;
			primaryError = error;
		}
		const fibers = [
			searchFiber,
			imageFiber,
			generateFiber
		];
		searchFiber = void 0;
		imageFiber = void 0;
		generateFiber = void 0;
		const cleanupErrors = [];
		for (const fiber of fibers) {
			if (fiber === void 0) continue;
			try {
				await fiber.dispose();
			} catch (error) {
				cleanupErrors.push(error);
			}
		}
		if (primaryFailed || cleanupErrors.length > 0) {
			const errors = primaryFailed ? [primaryError, ...cleanupErrors] : cleanupErrors;
			throw new AggregateError(errors, "dsh-llm-codex: optional capability cleanup failed");
		}
	}, "dsh-llm-codex: optional capability lifecycle");
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.installSection(ctx, NS, Config, config, {
			setSource: (source) => {
				current = source;
			},
			onChange: scheduleCapabilities
		});
	});
	scheduleCapabilities();
}
//#endregion
export { CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT, CODEX_AUTH_BEGIN_ENDPOINT, CODEX_AUTH_CANCEL_ENDPOINT, CODEX_AUTH_FILENAME, CODEX_AUTH_LOGIN_PATH, CODEX_AUTH_LOGOUT_ENDPOINT, CODEX_AUTH_LOGOUT_PATH, CODEX_AUTH_STATUS_ENDPOINT, CODEX_AUTH_STATUS_PATH, CODEX_BASE_URL, CODEX_CATALOG, CODEX_CHAT_BASE_URL, CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS, CODEX_FAST_SERVICE_TIER, CODEX_FAST_SUFFIX, CODEX_LARGE_CONTEXT_SUFFIX, CODEX_LARGE_CONTEXT_WINDOW, CODEX_MODELS_FETCH_ENDPOINT, CODEX_MODELS_URL, CODEX_MODEL_CACHE_FILENAME, CODEX_OFFICIAL_MODELS, CODEX_PROVIDER, CODEX_RPC_CHANNEL, CODEX_SAVE_ENDPOINT, CODEX_SEARCH_PROVIDER, CODEX_SEARCH_URL, CODEX_SETTINGS_NAMESPACE, CODEX_SETTINGS_READ_ENDPOINT, CODEX_USAGE_URL, CodexAdapter, CodexCredentialStore, CodexReauthRequiredError, CodexSearchProvider, CodexWebAuth, Config, DEFAULT_CODEX_IMAGE_GENERATION_MODEL, DEFAULT_CODEX_SEARCH_CONTEXT_SIZE, DEFAULT_CODEX_SEARCH_MAX_OUTPUT_TOKENS, DEFAULT_CODEX_SEARCH_MODE, DEFAULT_CODEX_SEARCH_MODEL, DEFAULT_CODEX_SETTINGS, GENERATE_IMAGE_TOOL_NAME, OPENAI_CODEX_PROVIDER, VIEW_IMAGE_TOOL_NAME, apply, applyCodexCatalogWire, applyCodexWirePayload, codexAuthPath, codexAuthStatus, codexResponsesApi, createCodexManagementRpcHandler, createCodexPiAiProfile, createCodexRpcHandler, decodeCodexCatalogModel, decodeCodexModelCatalog, decodeCodexSaveRequest, decodeCodexSaveResult, decodeCodexSettings, defaultDisplayedCatalog, externalWebAccess, generateImageTool, hydrateCatalogModel, inject, installCodexModelSwitchAdapters, isCodexReauthRequiredError, loginCodex, logoutCodex, mapCodexSearchResponse, name, officialImageGenerationModels, officialPickerCatalog, parseCodexUsage, readCodexRateLimits, refreshCodexAccessToken, refreshCodexModelCatalog, registerCodexAuthRoutes, resolveAdapterOptions, resolveCodexAccessToken, resolveWireModel, trustedRequest };
