window.__ModuleLoader__.load({
	id: "dsh-llm-codex",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/catalog.ts
		/** Suffix that marks a first-class Fast picker row. */
		const CODEX_FAST_SUFFIX = "-fast";
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
		/** Stable order for the Default thinking dropdown. */
		const CODEX_EFFORT_ORDER = [
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max",
			"ultra"
		];
		/** Short labels for advertised Codex reasoning levels. */
		const CODEX_EFFORT_LABELS = Object.freeze({
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
		/** Reasoning levels shown when Default thinking is available. */
		function effortsForCodexModel(model) {
			if (model.thinking === false) return [];
			const official = officialModelFor(model.id);
			if (official !== void 0) {
				const keys = new Set(Object.keys(official.thinkingLevelMap));
				keys.add(defaultCodexReasoningEffort(model.id));
				if (model.defaultEffort !== void 0) keys.add(model.defaultEffort);
				return CODEX_EFFORT_ORDER.filter((effort) => keys.has(effort));
			}
			if (model.thinking === true) return CODEX_EFFORT_ORDER.filter((effort) => effort !== "ultra" && effort !== "minimal");
			return [];
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
				...model.description === void 0 ? {} : { description: model.description }
			};
		}
		//#endregion
		//#region src/client-contract.ts
		/** Browser-safe constants and JSON decoders shared by Host and client faces. */
		/** Settings namespace owned by this plugin. */
		const CODEX_SETTINGS_NAMESPACE = "llm-codex";
		/** Default maximum idle interval while a stream read is outstanding. */
		const CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
		/** Private Connection RPC channel used for catalog save. */
		const CODEX_RPC_CHANNEL = "/codex";
		/** Atomic settings-save endpoint. */
		const CODEX_SAVE_ENDPOINT = "settings/save";
		/** Authoritative settings snapshot endpoint. */
		const CODEX_SETTINGS_READ_ENDPOINT = "settings/read";
		const CODEX_AUTH_STATUS_ENDPOINT = "auth/status";
		const CODEX_AUTH_BEGIN_ENDPOINT = "auth/begin";
		const CODEX_AUTH_CANCEL_ENDPOINT = "auth/cancel";
		const CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT = "auth/attempt-status";
		const CODEX_AUTH_LOGOUT_ENDPOINT = "auth/logout";
		const DEFAULT_CODEX_SETTINGS = Object.freeze({
			streamIdleTimeoutMs: CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
			models: Object.freeze(defaultDisplayedCatalog()),
			enableSearch: false,
			enableImageTool: false,
			enableImageGeneration: false,
			searchModel: "gpt-5.6-luna",
			imageGenerationModel: "gpt-5.6-luna",
			searchMode: "cached",
			searchContextSize: "medium",
			searchMaxOutputTokens: 1e4
		});
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		const TOKEN_FIELD = /^(?:accessToken|refreshToken|access_token|refresh_token|id_token|idToken|token)$/iu;
		function hasTokenFields(value) {
			return Object.keys(value).some((key) => TOKEN_FIELD.test(key));
		}
		function optionalString(record, key) {
			const value = record[key];
			return typeof value === "string" && value.length > 0 ? value : void 0;
		}
		function optionalBoolean(record, key) {
			const value = record[key];
			return typeof value === "boolean" ? value : void 0;
		}
		function optionalPositiveInt(record, key) {
			const value = record[key];
			return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : void 0;
		}
		/** Decode one catalog row; unknown extra fields are ignored. */
		function decodeCodexCatalogModel(value) {
			if (!isRecord(value) || typeof value["id"] !== "string" || value["id"].trim().length === 0) return void 0;
			const model = { id: value["id"].trim() };
			const name = optionalString(value, "name");
			const description = optionalString(value, "description");
			const contextWindow = optionalPositiveInt(value, "contextWindow");
			const maxTokens = optionalPositiveInt(value, "maxTokens");
			const thinking = optionalBoolean(value, "thinking");
			const defaultEffort = optionalString(value, "defaultEffort");
			const vision = optionalBoolean(value, "vision");
			const tools = optionalBoolean(value, "tools");
			const fast = optionalBoolean(value, "fast");
			if (name !== void 0) model.name = name;
			if (description !== void 0) model.description = description;
			if (contextWindow !== void 0) model.contextWindow = contextWindow;
			if (maxTokens !== void 0) model.maxTokens = maxTokens;
			if (thinking !== void 0) model.thinking = thinking;
			if (defaultEffort !== void 0) model.defaultEffort = defaultEffort;
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
		/** Narrow a redacted settings payload before it enters React state. */
		function decodeCodexSettings(value) {
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
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
		/** Decode a Host save reply. */
		function decodeCodexSaveResult(value) {
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
			const settings = decodeCodexSettings(value["settings"]);
			const revision = value["revision"];
			if (settings === void 0 || typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) return;
			return {
				settings,
				revision
			};
		}
		function decodeRateLimitWindow(value) {
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
			const remainingPercent = value["remainingPercent"];
			const windowSeconds = value["windowSeconds"];
			if (typeof remainingPercent !== "number" || !Number.isFinite(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) return;
			if (typeof windowSeconds !== "number" || !Number.isFinite(windowSeconds) || windowSeconds <= 0) return;
			const resetsAt = value["resetsAt"];
			if (resetsAt !== void 0 && (typeof resetsAt !== "string" || resetsAt.length === 0)) return void 0;
			return {
				remainingPercent,
				windowSeconds,
				...resetsAt === void 0 ? {} : { resetsAt }
			};
		}
		function decodeRateLimit(value) {
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
			const id = value["id"];
			const name = value["name"];
			const windows = value["windows"];
			if (typeof id !== "string" || id.length === 0 || !Array.isArray(windows)) return void 0;
			if (name !== void 0 && (typeof name !== "string" || name.length === 0)) return void 0;
			const decodedWindows = [];
			for (const item of windows) {
				const window = decodeRateLimitWindow(item);
				if (window === void 0) return void 0;
				decodedWindows.push(window);
			}
			return {
				id,
				...name === void 0 ? {} : { name },
				windows: decodedWindows
			};
		}
		function decodeCredits(value) {
			if (value === void 0) return void 0;
			if (!isRecord(value) || hasTokenFields(value) || typeof value["unlimited"] !== "boolean") return void 0;
			const balance = value["balance"];
			if (balance !== void 0 && (typeof balance !== "string" || balance.length === 0)) return void 0;
			return {
				unlimited: value["unlimited"],
				...balance === void 0 ? {} : { balance }
			};
		}
		function decodeIndividualLimit(value) {
			if (value === void 0) return void 0;
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
			const limit = value["limit"];
			const used = value["used"];
			const remaining = value["remaining"];
			const remainingPercent = value["remainingPercent"];
			if (typeof limit !== "string" || limit.length === 0) return void 0;
			if (typeof used !== "string" || used.length === 0) return void 0;
			if (typeof remaining !== "string" || remaining.length === 0) return void 0;
			if (typeof remainingPercent !== "number" || !Number.isFinite(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) return;
			return {
				limit,
				used,
				remaining,
				remainingPercent
			};
		}
		/** Narrow a secret-free usage snapshot before it enters React state. */
		function decodeCodexUsage(value) {
			if (!isRecord(value) || hasTokenFields(value) || !Array.isArray(value["rateLimits"])) return void 0;
			const rateLimits = [];
			for (const item of value["rateLimits"]) {
				const limit = decodeRateLimit(item);
				if (limit === void 0) return void 0;
				rateLimits.push(limit);
			}
			const credits = decodeCredits(value["credits"]);
			if (value["credits"] !== void 0 && credits === void 0) return void 0;
			const individualLimit = decodeIndividualLimit(value["individualLimit"]);
			if (value["individualLimit"] !== void 0 && individualLimit === void 0) return void 0;
			return {
				rateLimits,
				...credits === void 0 ? {} : { credits },
				...individualLimit === void 0 ? {} : { individualLimit }
			};
		}
		/** Narrow the Host auth status. Token-shaped fields fail closed. */
		function decodeCodexAuthStatus(value) {
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
			const status = value["status"];
			if (status === "signed-out" || status === "signing-in") return { status };
			if (status === "reauth-required" || status === "error") {
				if (typeof value["message"] !== "string" || value["message"].length === 0) return void 0;
				return {
					status,
					message: value["message"]
				};
			}
			if (status !== "signed-in") return void 0;
			const usage = decodeCodexUsage(value["usage"]);
			if (usage === void 0) return void 0;
			const quotaError = value["quotaError"];
			if (quotaError !== void 0 && (typeof quotaError !== "string" || quotaError.length === 0)) return void 0;
			return {
				status,
				usage,
				...quotaError === void 0 ? {} : { quotaError }
			};
		}
		/** Narrow the Host login reply. Only an http(s) system-browser URL is accepted. */
		function decodeCodexAuthLoginReply(value) {
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
			const url = value["url"];
			const verificationUri = value["verificationUri"];
			const userCode = value["userCode"];
			const attemptId = value["attemptId"];
			if (attemptId !== void 0 && (typeof attemptId !== "string" || attemptId.length === 0)) return void 0;
			if (url !== void 0) {
				if (typeof url !== "string" || url.length === 0) return void 0;
				try {
					const parsed = new URL(url);
					if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return void 0;
				} catch {
					return;
				}
			}
			if (verificationUri !== void 0 && (typeof verificationUri !== "string" || verificationUri.length === 0)) return void 0;
			if (userCode !== void 0 && (typeof userCode !== "string" || userCode.length === 0)) return void 0;
			const expiresAt = value["expiresAt"];
			if (expiresAt !== void 0 && (typeof expiresAt !== "number" || !Number.isFinite(expiresAt))) return void 0;
			if (url === void 0 && (verificationUri === void 0 || userCode === void 0)) return void 0;
			return {
				...url === void 0 ? {} : { url },
				...verificationUri === void 0 ? {} : { verificationUri },
				...userCode === void 0 ? {} : { userCode },
				...expiresAt === void 0 ? {} : { expiresAt },
				...attemptId === void 0 ? {} : { attemptId }
			};
		}
		/** Narrow secret-free auth attempt status. */
		function decodeCodexAuthAttemptStatus(value) {
			if (!isRecord(value) || hasTokenFields(value)) return void 0;
			const status = value["status"];
			return status === "pending" || status === "succeeded" || status === "failed" || status === "cancelled" || status === "missing" ? { status } : void 0;
		}
		/** Narrow the Host logout reply. */
		function decodeCodexAuthLogoutReply(value) {
			if (!isRecord(value) || hasTokenFields(value) || value["ok"] !== true) return void 0;
			return { ok: true };
		}
		Object.freeze(defaultDisplayedCatalog());
		//#endregion
		//#region src/client/BrandMark.tsx
		const PATH = "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z";
		const SIZE = 18;
		/** Compact OpenAI logo (currentColor, 18px). */
		function BrandMark() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: SIZE,
				height: SIZE,
				viewBox: "0 0 24 24",
				"aria-hidden": "true",
				style: { flex: "none" },
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					fill: "currentColor",
					d: PATH
				})
			});
		}
		//#endregion
		//#region src/client/provider-chrome.tsx
		const REFRESH_PATH = "M1.272 6.21348C1.70645 3.08888 4.59169 0.908064 7.71634 1.34239C8.95495 1.51469 10.0438 2.07331 10.8814 2.87755L11.9458 1.81407C12.1347 1.6255 12.4572 1.75911 12.4575 2.02598V5.08751C12.4574 5.25303 12.3233 5.38731 12.1577 5.38731H9.0972C8.82993 5.38731 8.69629 5.06361 8.88528 4.87462L10.0327 3.72618C9.3732 3.09994 8.52006 2.66569 7.5513 2.53087C5.08313 2.18779 2.80376 3.91044 2.46048 6.37852C2.11747 8.84665 3.84009 11.1261 6.30814 11.4693C8.77612 11.8121 11.0557 10.0896 11.399 7.62169L11.9937 7.70372L12.5874 7.78673C12.153 10.9112 9.26756 13.0919 6.1431 12.6578C3.01854 12.2234 0.837738 9.33809 1.272 6.21348Z";
		function ensureMotionStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-provider-motion") !== null) return;
			const style = document.createElement("style");
			style.id = "dsh-provider-motion";
			style.textContent = ["@keyframes dsh-provider-spin{to{transform:rotate(360deg)}}", "@keyframes dsh-provider-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}"].join("");
			document.head.appendChild(style);
		}
		const iconButtonStyle$1 = {
			boxSizing: "border-box",
			width: 28,
			height: 28,
			padding: 0,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 999,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			cursor: "pointer",
			flex: "none"
		};
		const authRowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12
		};
		const trackStyle = {
			boxSizing: "border-box",
			height: 14,
			overflow: "hidden",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)"
		};
		const shimmerStyle = {
			display: "block",
			width: "100%",
			height: "100%",
			background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent) 50%, transparent 100%)",
			backgroundSize: "200% 100%",
			animation: "dsh-provider-shimmer 1.25s ease-in-out infinite"
		};
		const chipStyle = {
			display: "inline-block",
			height: 12,
			borderRadius: 4,
			background: "linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent) 0%, color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent) 50%, color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent) 100%)",
			backgroundSize: "200% 100%",
			animation: "dsh-provider-shimmer 1.25s ease-in-out infinite"
		};
		/** Account status on the left, sign-in / sign-out on the right. */
		function AuthToolbar(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: authRowStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						minWidth: 0,
						flex: 1
					},
					children: props.status
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: { flex: "none" },
					children: props.action
				})]
			});
		}
		/** Official `ic_ds_refresh_outline_14` glyph; spins while refreshing. */
		function RefreshIcon(props) {
			ensureMotionStyles();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				style: props.spinning === true ? { animation: "dsh-provider-spin 0.8s linear infinite" } : void 0,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					fill: "currentColor",
					d: REFRESH_PATH
				})
			});
		}
		/** Icon-only refresh control used by every provider usage block. */
		function UsageRefreshButton(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				style: iconButtonStyle$1,
				disabled: props.disabled === true,
				"aria-label": props.spinning ? props.busyLabel : props.label,
				onClick: props.onClick,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshIcon, { spinning: props.spinning })
			});
		}
		/** Quota chart skeleton: same 14px tracks as live bars, with a moving sheen. */
		function UsageSkeleton(props) {
			ensureMotionStyles();
			const rows = props.rows ?? 2;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 10
				},
				"aria-hidden": "true",
				children: Array.from({ length: rows }, (_, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 6
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: 10
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
							...chipStyle,
							width: index === 0 ? 92 : 78
						} }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
							...chipStyle,
							width: 36
						} })]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: trackStyle,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: shimmerStyle })
					})]
				}, index))
			});
		}
		/**
		* Title + official refresh glyph used above usage bars.
		* @param props.title - localized usage heading.
		* @param props.spinning - whether a refresh is in flight.
		* @param props.disabled - when true, the refresh button is inert.
		* @param props.refreshLabel - idle aria-label.
		* @param props.busyLabel - aria-label while spinning.
		* @param props.onRefresh - fetch handler.
		* @param props.error - short failure hint shown left of the button.
		* @returns the usage block heading row.
		*/
		function UsageHeader(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 10
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					style: {
						margin: 0,
						fontSize: 13,
						fontWeight: 600,
						lineHeight: "18px"
					},
					children: props.title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						flex: "none"
					},
					children: [props.error !== void 0 && props.error.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: 12,
							lineHeight: "18px",
							color: "var(--dsw-alias-state-error-primary)"
						},
						children: props.error
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageRefreshButton, {
						spinning: props.spinning,
						disabled: props.disabled === true,
						label: props.refreshLabel,
						busyLabel: props.busyLabel,
						onClick: props.onRefresh
					})]
				})]
			});
		}
		/** Format a usage stamp as a compact local clock, e.g. "12:04". */
		function formatUsageClock(at) {
			return at.toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false
			});
		}
		function interpolateCopy(template, params) {
			return template.replace(/\{(\w+)\}/gu, (_match, key) => String(params[key] ?? ""));
		}
		function chineseLocale(locales) {
			const locale = typeof locales === "string" ? locales : locales?.[0] ?? (typeof navigator === "undefined" ? void 0 : navigator.language);
			return typeof locale === "string" && /^zh\b/iu.test(locale);
		}
		function pad2(value) {
			return String(value).padStart(2, "0");
		}
		/** Official grok.com form: 2026年8月20日 11:35. English stays a short local datetime. */
		function formatResetStamp(iso, locales) {
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return iso;
			if (chineseLocale(locales)) return String(at.getFullYear()) + "年" + String(at.getMonth() + 1) + "月" + String(at.getDate()) + "日 " + pad2(at.getHours()) + ":" + pad2(at.getMinutes());
			return new Intl.DateTimeFormat(locales, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false
			}).format(at);
		}
		/** Official Cursor form: Sep 16 / 9月16日. */
		function formatResetDate(iso, locales) {
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return iso;
			if (chineseLocale(locales)) return String(at.getMonth() + 1) + "月" + String(at.getDate()) + "日";
			return new Intl.DateTimeFormat(locales, {
				month: "short",
				day: "numeric"
			}).format(at);
		}
		/** Whole days until reset when at least one day remains; otherwise the datetime form is used. */
		function remainingResetDays(iso, now = Date.now()) {
			const at = Date.parse(iso);
			if (!Number.isFinite(at)) return void 0;
			const days = Math.round((at - now) / 864e5);
			return days >= 1 ? days : void 0;
		}
		/** Localized reset line matching official dashboards. */
		function resetLabelOf(iso, copy, now) {
			if (iso === void 0) return void 0;
			const locales = copy.at.includes("重置") ? "zh-CN" : "en";
			const days = remainingResetDays(iso, now);
			if (days !== void 0) return interpolateCopy(copy.atDays, {
				date: formatResetDate(iso, locales),
				count: days
			});
			return interpolateCopy(copy.at, { time: formatResetStamp(iso, locales) });
		}
		/** Official-style reset caption under a usage bar. */
		function UsageResetAt(props) {
			if (props.label === void 0 || props.label.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: {
					margin: 0,
					fontSize: 12,
					lineHeight: "18px",
					color: "var(--dsw-alias-label-tertiary)"
				},
				children: props.label
			});
		}
		/**
		* Last successful usage read, right-aligned under the bars.
		* @param props.at - when the last successful snapshot arrived.
		* @param props.label - already-localized "12:04 已更新".
		* @returns the stamp, or nothing before the first success.
		*/
		function UsageUpdatedAt(props) {
			if (props.at === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: {
					margin: 0,
					textAlign: "right",
					fontSize: 12,
					lineHeight: "18px",
					color: "var(--dsw-alias-label-tertiary)"
				},
				children: props.label
			});
		}
		const providerHeaderStyle = {
			boxSizing: "border-box",
			width: "100%",
			minHeight: 68,
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 16,
			border: 0,
			padding: "12px 14px",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
		/** Join connection status and model count: "已登录 · 8 个模型". */
		function formatProviderSummary(status, modelsLabel) {
			return status.replace(/[。.]$/u, "") + " · " + modelsLabel;
		}
		/** Fixed-height collapsed header: mark, title, status · count, chevron. */
		function ProviderCardHeader(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: {
					display: "flex",
					minWidth: 0,
					flex: 1,
					flexDirection: "column",
					gap: 4
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						fontSize: 14,
						fontWeight: 600,
						lineHeight: 1
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							width: 18,
							height: 18,
							flex: "none",
							display: "block",
							overflow: "visible"
						},
						children: props.mark
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: { lineHeight: "20px" },
						children: props.title
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						fontSize: 13,
						lineHeight: "18px",
						color: "var(--dsw-alias-label-tertiary)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis"
					},
					children: props.summary
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 10,
					flex: "none"
				},
				children: [props.unsaved === true && props.unsavedLabel !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						fontSize: 12,
						color: "var(--dsw-alias-label-tertiary)"
					},
					children: props.unsavedLabel
				}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": "true",
					style: {
						fontSize: 18,
						transform: props.open ? "rotate(180deg)" : "none"
					},
					children: "⌄"
				})]
			})] });
		}
		//#endregion
		//#region node_modules/.pnpm/dsh-llm-providers-ui@file+..+dsh-llm-providers-ui+dsh-llm-providers-ui-0.1.1.tgz_68ce2f6f68094209ed9dc2f9dfacc307/node_modules/dsh-llm-providers-ui/lib/sortable.js
		/** Pointer-driven sortable list with a floating ghost and animated live preview. */
		const listStyle$1 = {
			display: "flex",
			flexDirection: "column",
			gap: 8
		};
		const rowStyle$1 = {
			display: "grid",
			gridTemplateColumns: "30px minmax(0, 1fr)",
			alignItems: "stretch",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			transition: "box-shadow 150ms ease, opacity 150ms ease, transform 150ms ease"
		};
		const handleStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 30,
			minHeight: 42,
			alignSelf: "stretch",
			border: 0,
			borderRight: "1px solid var(--dsw-alias-border-l2)",
			padding: 0,
			flex: "none",
			touchAction: "none",
			userSelect: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const cardRowStyle = {
			...rowStyle$1,
			borderRadius: 10,
			background: "var(--dsw-alias-bg-module-platform)",
			overflow: "hidden"
		};
		const cardItemStyle = {
			minWidth: 0,
			display: "flex",
			flexDirection: "column"
		};
		const cardCss = "[data-sortable-card] [data-sortable-item] li,[data-sortable-ghost] [data-sortable-item] li{border:0!important;border-radius:0!important;background:transparent!important;overflow:visible!important;list-style:none;margin:0}";
		const ghostStyle = {
			...rowStyle$1,
			position: "fixed",
			zIndex: 1e4,
			pointerEvents: "none",
			opacity: .96,
			boxShadow: "var(--dsw-shadow-lv2, 0 10px 30px rgba(0, 0, 0, 0.18))",
			outline: "2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent)"
		};
		/** Grip glyph marking one row's pointer handle. */
		function IconGrip() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "10",
				height: "14",
				viewBox: "0 0 10 14",
				fill: "currentColor",
				"aria-hidden": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "2.5",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "2.5",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "7",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "7",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "11.5",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "11.5",
						r: "1.2"
					})
				]
			});
		}
		/**
		* Pointer-driven sortable list: a portal ghost follows the pointer, a preview
		* array records the prospective order, and FLIP animations move sibling rows.
		*/
		function SortableList({ items, getId, renderItem, dragLabel, onReorder, disabled = false, chrome = "row" }) {
			const card = chrome === "card";
			const [draggedId, setDraggedId] = (0, react.useState)(null);
			const [dropTargetId, setDropTargetId] = (0, react.useState)(null);
			const [previewItems, setPreviewItems] = (0, react.useState)(null);
			const [dragGhost, setDragGhost] = (0, react.useState)(null);
			const rowRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const previousRects = (0, react.useRef)(null);
			const previewRef = (0, react.useRef)(null);
			const dragGhostRef = (0, react.useRef)(null);
			const renderedItems = previewItems ?? items;
			const draggedItem = draggedId === null ? void 0 : renderedItems.find((item) => getId(item) === draggedId) ?? items.find((item) => getId(item) === draggedId);
			(0, react.useEffect)(() => {
				if (draggedId === null) return;
				const style = document.createElement("style");
				style.textContent = "html.providers-sortable-dragging, html.providers-sortable-dragging * { cursor: grabbing !important; user-select: none !important; }";
				const previousRootCursor = document.documentElement.style.cursor;
				const previousBodyCursor = document.body.style.cursor;
				document.head.appendChild(style);
				document.documentElement.classList.add("providers-sortable-dragging");
				document.documentElement.style.cursor = "grabbing";
				document.body.style.cursor = "grabbing";
				return () => {
					document.documentElement.classList.remove("providers-sortable-dragging");
					style.remove();
					document.documentElement.style.cursor = previousRootCursor;
					document.body.style.cursor = previousBodyCursor;
				};
			}, [draggedId]);
			(0, react.useEffect)(() => {
				if (draggedId === null) return;
				const handlePointerMove = (event) => {
					const currentGhost = dragGhostRef.current;
					if (currentGhost === null) return;
					event.preventDefault();
					const nextGhost = {
						...currentGhost,
						x: event.clientX - currentGhost.offsetX,
						y: event.clientY - currentGhost.offsetY
					};
					dragGhostRef.current = nextGhost;
					setDragGhost(nextGhost);
					movePreviewFromPointer(nextGhost.y + nextGhost.height / 2);
				};
				const handlePointerUp = (event) => {
					event.preventDefault();
					finishDrag(true);
				};
				const handlePointerCancel = (event) => {
					event.preventDefault();
					finishDrag(false);
				};
				const handleKeyDown = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					finishDrag(false);
				};
				window.addEventListener("pointermove", handlePointerMove, { passive: false });
				window.addEventListener("pointerup", handlePointerUp, { passive: false });
				window.addEventListener("pointercancel", handlePointerCancel, { passive: false });
				window.addEventListener("keydown", handleKeyDown);
				return () => {
					window.removeEventListener("pointermove", handlePointerMove);
					window.removeEventListener("pointerup", handlePointerUp);
					window.removeEventListener("pointercancel", handlePointerCancel);
					window.removeEventListener("keydown", handleKeyDown);
				};
			}, [draggedId]);
			(0, react.useLayoutEffect)(() => {
				const rects = previousRects.current;
				if (rects === null) return;
				previousRects.current = null;
				rowRefs.current.forEach((node, id) => {
					const previous = rects.get(id);
					if (previous === void 0) return;
					const next = node.getBoundingClientRect();
					const deltaX = previous.left - next.left;
					const deltaY = previous.top - next.top;
					if (deltaX === 0 && deltaY === 0 || typeof node.animate !== "function") return;
					node.animate([{ transform: "translate(" + String(deltaX) + "px, " + String(deltaY) + "px)" }, { transform: "translate(0, 0)" }], {
						duration: 160,
						easing: "cubic-bezier(0.2, 0, 0, 1)"
					});
				});
			}, [renderedItems]);
			const startDrag = (event, id) => {
				if (disabled || event.button !== 0) return;
				const row = event.currentTarget.closest("[data-sortable-row=\"true\"]");
				if (!(row instanceof HTMLElement)) return;
				event.preventDefault();
				event.currentTarget.focus();
				try {
					event.currentTarget.setPointerCapture(event.pointerId);
				} catch {}
				const rect = row.getBoundingClientRect();
				const nextGhost = {
					id,
					x: rect.left,
					y: rect.top,
					width: rect.width,
					height: rect.height,
					offsetX: event.clientX - rect.left,
					offsetY: event.clientY - rect.top
				};
				dragGhostRef.current = nextGhost;
				const initial = [...items];
				previewRef.current = initial;
				setPreviewItems(initial);
				setDragGhost(nextGhost);
				setDraggedId(id);
			};
			const finishDrag = (commit) => {
				const next = previewRef.current;
				if (commit && next !== null && !sameOrder(next, items, getId)) onReorder(next);
				previewRef.current = null;
				dragGhostRef.current = null;
				setPreviewItems(null);
				setDragGhost(null);
				setDraggedId(null);
				setDropTargetId(null);
			};
			const captureRects = () => {
				previousRects.current = new Map(Array.from(rowRefs.current.entries()).map(([id, node]) => [id, node.getBoundingClientRect()]));
			};
			const setRowRef = (id, node) => {
				if (node === null) rowRefs.current.delete(id);
				else rowRefs.current.set(id, node);
			};
			const movePreviewFromPointer = (pointerY) => {
				if (draggedId === null) return;
				const current = previewRef.current ?? [...items];
				const from = current.findIndex((item) => getId(item) === draggedId);
				if (from < 0) return;
				const dragged = current[from];
				if (dragged === void 0) return;
				const remaining = current.filter((item) => getId(item) !== draggedId);
				let insertionIndex = remaining.length;
				let nextDropTargetId = remaining.length === 0 ? null : getId(remaining[remaining.length - 1]);
				for (let index = 0; index < remaining.length; index += 1) {
					const item = remaining[index];
					if (item === void 0) continue;
					const id = getId(item);
					const node = rowRefs.current.get(id);
					if (node === void 0) continue;
					const rect = node.getBoundingClientRect();
					if (pointerY < rect.top + rect.height / 2) {
						insertionIndex = index;
						nextDropTargetId = id;
						break;
					}
				}
				const next = [
					...remaining.slice(0, insertionIndex),
					dragged,
					...remaining.slice(insertionIndex)
				];
				setDropTargetId(nextDropTargetId);
				if (sameOrder(next, current, getId)) return;
				captureRects();
				previewRef.current = next;
				setPreviewItems(next);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-sortable-card": card ? "" : void 0,
				style: {
					...listStyle$1,
					...card ? { gap: 12 } : {}
				},
				children: [
					card ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: cardCss }) : null,
					renderedItems.map((item, index) => {
						const id = getId(item);
						const dragging = draggedId === id;
						const targeted = dropTargetId === id && draggedId !== id;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							ref: (node) => {
								setRowRef(id, node);
							},
							"data-sortable-row": "true",
							style: {
								...card ? cardRowStyle : rowStyle$1,
								visibility: dragging ? "hidden" : "visible",
								pointerEvents: dragging ? "none" : "auto",
								borderColor: dragging ? "transparent" : "var(--dsw-alias-border-l2)",
								boxShadow: targeted ? "0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 20%, transparent)" : "none"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...handleStyle,
									cursor: disabled ? "default" : draggedId === null ? "grab" : "grabbing"
								},
								"aria-label": dragLabel(item, index),
								"aria-grabbed": dragging,
								title: dragLabel(item, index),
								disabled,
								onDragStart: (event) => {
									event.preventDefault();
								},
								onPointerDown: (event) => {
									startDrag(event, id);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGrip, {})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								"data-sortable-item": "",
								style: card ? cardItemStyle : { minWidth: 0 },
								children: renderItem(item, index)
							})]
						}, id);
					}),
					dragGhost !== null && draggedItem !== void 0 ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						"data-sortable-ghost": "true",
						style: {
							...ghostStyle,
							...card ? cardRowStyle : {},
							position: "fixed",
							left: dragGhost.x,
							top: dragGhost.y,
							width: dragGhost.width,
							minHeight: dragGhost.height
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								...handleStyle,
								cursor: "grabbing"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGrip, {})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							"data-sortable-item": "",
							style: card ? cardItemStyle : { minWidth: 0 },
							children: renderItem(draggedItem, renderedItems.findIndex((item) => getId(item) === draggedId))
						})]
					}), document.body) : null
				]
			});
		}
		function sameOrder(left, right, getId) {
			return left.length === right.length && left.every((item, index) => {
				const other = right[index];
				return other !== void 0 && getId(item) === getId(other);
			});
		}
		//#endregion
		//#region src/client/model-catalog-ui.tsx
		const inputStyle = {
			boxSizing: "border-box",
			width: "100%",
			minHeight: 36,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "7px 10px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit"
		};
		const rowInputStyle = {
			...inputStyle,
			minHeight: 32,
			padding: "4px 10px"
		};
		const selectStyle = {
			boxSizing: "border-box",
			minHeight: 32,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "4px 28px 4px 10px",
			backgroundColor: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			appearance: "none",
			backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
			backgroundRepeat: "no-repeat",
			backgroundPosition: "right 8px center"
		};
		const rowStyle = {
			display: "grid",
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
			gap: 10
		};
		const modelContentStyle = {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto auto",
			alignItems: "center",
			gap: 6,
			padding: "6px 8px"
		};
		const modelDetailStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			padding: "10px 4px 4px"
		};
		const capabilitiesStyle = {
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 14
		};
		const fieldStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const labelStyle = {
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
		};
		/** Small interface that hides the shared styles behind layout components. */
		function ModelCatalogDetails({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					...modelDetailStyle,
					gridColumn: "1 / -1"
				},
				children
			});
		}
		function ModelCatalogRow({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: rowStyle,
				children
			});
		}
		function ModelCatalogCapabilities({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: capabilitiesStyle,
				children
			});
		}
		//#endregion
		//#region src/client/CodexPluginCard.tsx
		/** Codex Plugin configuration card: ChatGPT login, usage, and an editable catalog. */
		const cardStyle = {
			overflow: "hidden",
			fontFamily: "var(--dsw-font-family)",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 10,
			background: "var(--dsw-alias-bg-module-platform)"
		};
		const headerStyle$1 = providerHeaderStyle;
		const bodyStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 18,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			padding: "16px 14px 18px"
		};
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 12
		};
		const sectionTitleStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const hintStyle = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const statusStyle$1 = {
			margin: 0,
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle$1 = {
			...statusStyle$1,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const buttonStyle = {
			alignSelf: "flex-start",
			minHeight: 34,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			padding: "6px 14px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			cursor: "pointer"
		};
		const primaryButtonStyle = {
			...buttonStyle,
			borderColor: "var(--dsw-alias-button-primary-fill)",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		const actionsStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 10
		};
		const iconButtonStyle = {
			boxSizing: "border-box",
			width: 28,
			height: 28,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "none",
			border: 0,
			borderRadius: 6,
			padding: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			cursor: "pointer"
		};
		const disclosureStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0,
			border: 0,
			padding: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
		const checkboxStyle = { accentColor: "var(--dsw-alias-brand-primary)" };
		const barTrackStyle = {
			boxSizing: "border-box",
			height: 14,
			display: "flex",
			overflow: "hidden",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)"
		};
		let nextModelRow = 0;
		function newModelRowId() {
			nextModelRow += 1;
			return "codex-model-row-" + String(nextModelRow);
		}
		function integerOf(text) {
			const trimmed = text.trim();
			if (trimmed.length === 0) return void 0;
			if (!/^[1-9]\d*$/u.test(trimmed)) return NaN;
			return Number(trimmed);
		}
		function modelDraftOf(model) {
			return {
				rowId: newModelRowId(),
				id: model.id,
				contextWindow: model.contextWindow === void 0 ? "" : String(model.contextWindow),
				...model.name === void 0 ? {} : { name: model.name },
				...model.thinking === void 0 ? {} : { thinking: model.thinking },
				...model.vision === void 0 ? {} : { vision: model.vision },
				...model.defaultEffort === void 0 ? {} : { defaultEffort: model.defaultEffort },
				...model.fast === void 0 ? {} : { fast: model.fast }
			};
		}
		function modelSettingsOf(draft) {
			const contextWindow = integerOf(draft.contextWindow);
			return {
				id: draft.id.trim(),
				...draft.name === void 0 || draft.name.trim().length === 0 ? {} : { name: draft.name.trim() },
				...draft.thinking === void 0 ? {} : { thinking: draft.thinking },
				...draft.vision === void 0 ? {} : { vision: draft.vision },
				...draft.defaultEffort === void 0 ? {} : { defaultEffort: draft.defaultEffort },
				...contextWindow === void 0 || Number.isNaN(contextWindow) ? {} : { contextWindow },
				...draft.fast === void 0 ? {} : { fast: draft.fast }
			};
		}
		function imageGenerationPickerModels(selected) {
			const models = officialImageGenerationModels();
			if (selected.length === 0 || models.some((model) => model.id === selected)) return models;
			return [...models, {
				id: selected,
				name: selected
			}];
		}
		function capabilityOf(value) {
			return {
				enableSearch: value.enableSearch,
				enableImageTool: value.enableImageTool,
				enableImageGeneration: value.enableImageGeneration,
				searchModel: value.searchModel,
				imageGenerationModel: value.imageGenerationModel,
				searchMode: value.searchMode,
				searchContextSize: value.searchContextSize,
				searchMaxOutputTokens: value.searchMaxOutputTokens
			};
		}
		function sameDraft(left, right) {
			return JSON.stringify(left.map(modelSettingsOf)) === JSON.stringify(right.map(modelSettingsOf));
		}
		function modelFailure(models) {
			const ids = /* @__PURE__ */ new Set();
			for (const model of models) {
				const id = model.id.trim();
				if (id.length === 0 || ids.has(id)) return true;
				if (Number.isNaN(integerOf(model.contextWindow))) return true;
				ids.add(id);
			}
			return false;
		}
		function messageOf(error, fallback) {
			return error instanceof Error && error.message.length > 0 ? error.message : fallback;
		}
		function formatPercent(percent) {
			return new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(percent);
		}
		function interpolate(template, params) {
			return template.replace(/\{(\w+)\}/gu, (_match, key) => String(params[key] ?? ""));
		}
		function windowLabel(seconds, t) {
			if (seconds === 18e3) return t("fiveHourLimit");
			if (seconds === 604800) return t("weeklyLimit");
			const hours = seconds / 3600;
			return Number.isInteger(hours) ? interpolate(t("hourLimit"), { count: hours }) : t("usageWindow");
		}
		function Capability({ label, checked, disabled, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: {
					...labelStyle,
					display: "inline-flex",
					alignItems: "center",
					gap: 6
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					style: checkboxStyle,
					checked,
					disabled,
					onChange: (event) => {
						onChange(event.target.checked);
					}
				}), label]
			});
		}
		function IconChevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "12",
				height: "12",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				style: {
					flex: "none",
					transform: open ? "rotate(90deg)" : "none",
					transition: "transform 120ms ease"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6 3.5L10.5 8L6 12.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function IconTrash() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4M6.5 6.8v4.4M9.5 6.8v4.4",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function DeviceCodeRow({ code, t }) {
			const [copied, setCopied] = (0, react.useState)(false);
			const timeout = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => () => {
				if (timeout.current !== void 0) window.clearTimeout(timeout.current);
			}, []);
			const fallbackCopy = () => {
				const textarea = document.createElement("textarea");
				textarea.value = code;
				textarea.setAttribute("readonly", "");
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				textarea.remove();
			};
			const copy = async () => {
				try {
					await navigator.clipboard?.writeText(code);
				} catch {
					fallbackCopy();
				}
				if (timeout.current !== void 0) window.clearTimeout(timeout.current);
				setCopied(true);
				timeout.current = window.setTimeout(() => setCopied(false), 1800);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 10
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
					style: {
						fontSize: 20,
						fontWeight: 700,
						letterSpacing: 2
					},
					children: code
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: buttonStyle,
					onClick: () => {
						copy();
					},
					children: copied ? t("copied") : t("copyCode")
				})]
			});
		}
		function UsageLimits({ usage, quotaError, t }) {
			if (quotaError !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: hintStyle,
				children: t("quotaUnavailable")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [usage.rateLimits.map((limit) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 8
					},
					children: limit.windows.map((window) => {
						const remaining = Math.max(0, Math.min(100, window.remainingPercent));
						const label = windowLabel(window.windowSeconds, t);
						const displayLabel = limit.name === void 0 || limit.windows.length === 1 ? limit.name ?? label : limit.name + " · " + label;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: 6
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										justifyContent: "space-between",
										gap: 10
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: labelStyle,
										children: displayLabel
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: hintStyle,
										children: interpolate(t("percentRemaining"), { percent: formatPercent(remaining) })
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: barTrackStyle,
									role: "progressbar",
									"aria-label": displayLabel,
									"aria-valuemin": 0,
									"aria-valuemax": 100,
									"aria-valuenow": Math.round(remaining),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"data-usage-fill": "true",
										style: {
											width: String(remaining) + "%",
											height: "100%",
											flex: "none",
											background: "var(--dsw-alias-state-business-primary)",
											transition: "width 200ms ease"
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageResetAt, { label: resetLabelOf(window.resetsAt, {
									at: t("usageResetAt"),
									atDays: t("usageResetAtDays")
								}) })
							]
						}, label + String(window.windowSeconds));
					})
				}, limit.id)), usage.credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: hintStyle,
					children: usage.credits.unlimited ? t("unlimited") : usage.credits.balance === void 0 ? t("credits") : interpolate(t("exactRemaining"), {
						remaining: usage.credits.balance,
						limit: usage.credits.balance
					})
				})]
			});
		}
		function CodexPluginCard(props) {
			const { t, readAuthStatus, readAuthAttemptStatus, startAuth, logout, cancelAuth, fetchModels } = props;
			const snapshot = props.useCodexSettings((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			const initial = (0, react.useMemo)(() => snapshot.value === void 0 ? void 0 : snapshot.value.models.map(modelDraftOf), [snapshot.value]);
			const [source, setSource] = (0, react.useState)(initial);
			const [draft, setDraft] = (0, react.useState)(initial);
			const [capabilities, setCapabilities] = (0, react.useState)(snapshot.value === void 0 ? void 0 : capabilityOf(snapshot.value));
			const [sourceRevision, setSourceRevision] = (0, react.useState)(snapshot.revision);
			const [auth, setAuth] = (0, react.useState)({ status: "loading" });
			const [authChallenge, setAuthChallenge] = (0, react.useState)();
			const [catalogOpen, setCatalogOpen] = (0, react.useState)(false);
			const [expandedModels, setExpandedModels] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [quotaRefreshing, setQuotaRefreshing] = (0, react.useState)(false);
			const [lastUsage, setLastUsage] = (0, react.useState)(void 0);
			const [usageUpdatedAt, setUsageUpdatedAt] = (0, react.useState)(void 0);
			const [refreshError, setRefreshError] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [authBusy, setAuthBusy] = (0, react.useState)(false);
			const [fetching, setFetching] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const [notice, setNotice] = (0, react.useState)(void 0);
			const mounted = (0, react.useRef)(true);
			const authAttempt = (0, react.useRef)(0);
			const title = t("title");
			const signingIn = auth.status === "signing-in";
			const disabled = snapshot.status !== "ready" || !snapshot.writable || busy;
			const dirtyModels = source !== void 0 && draft !== void 0 && !sameDraft(source, draft);
			const dirtyCaps = snapshot.value !== void 0 && capabilities !== void 0 && JSON.stringify(capabilityOf(snapshot.value)) !== JSON.stringify(capabilities);
			const dirty = dirtyModels || dirtyCaps;
			const invalidModels = draft !== void 0 && modelFailure(draft);
			const invalidCaps = capabilities !== void 0 && (capabilities.searchModel.trim().length === 0 || capabilities.imageGenerationModel.trim().length === 0 || !Number.isInteger(capabilities.searchMaxOutputTokens) || capabilities.searchMaxOutputTokens < 1);
			const invalid = invalidModels || invalidCaps;
			const customModels = snapshot.user !== void 0 && Object.prototype.hasOwnProperty.call(snapshot.user, "models");
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				if (snapshot.status !== "ready" || snapshot.value === void 0) return;
				if (snapshot.revision === sourceRevision) return;
				if (dirty) return;
				const next = snapshot.value.models.map(modelDraftOf);
				setSource(next);
				setDraft(next);
				setCapabilities(capabilityOf(snapshot.value));
				setSourceRevision(snapshot.revision);
			}, [
				dirty,
				snapshot.revision,
				snapshot.status,
				snapshot.value,
				sourceRevision
			]);
			(0, react.useEffect)(() => () => {
				props.closeModelPicker();
			}, [props.closeModelPicker]);
			const refreshAuth = (0, react.useCallback)(async (signal, spin = false) => {
				if (spin) setQuotaRefreshing(true);
				try {
					const next = await readAuthStatus(signal);
					if (!mounted.current || signal?.aborted === true) return;
					setAuth(next);
					if (next.status !== "signing-in") setAuthChallenge(void 0);
					if (next.status === "signed-in") {
						if (next.quotaError === void 0) {
							setLastUsage(next.usage);
							setUsageUpdatedAt(/* @__PURE__ */ new Date());
							setRefreshError(void 0);
						} else setRefreshError(t("usageRefreshFailed"));
					}
				} catch (error) {
					if (mounted.current && signal?.aborted !== true) {
						setRefreshError(t("usageRefreshFailed"));
						setAuth((current) => current.status === "signed-in" ? current : {
							status: "error",
							message: messageOf(error, t("statusFailed"))
						});
					}
				} finally {
					if (spin && mounted.current) setQuotaRefreshing(false);
				}
			}, [readAuthStatus, t]);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				refreshAuth(controller.signal);
				return () => {
					controller.abort();
				};
			}, [refreshAuth]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const controller = new AbortController();
				refreshAuth(controller.signal, true);
				return () => {
					controller.abort();
				};
			}, [open, refreshAuth]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const interval = auth.status === "signing-in" ? 1e3 : auth.status === "signed-in" ? 6e4 : void 0;
				if (interval === void 0) return;
				const controller = new AbortController();
				const timer = window.setInterval(() => {
					refreshAuth(controller.signal);
				}, interval);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [
				open,
				auth.status,
				refreshAuth
			]);
			(0, react.useEffect)(() => {
				if (!open || auth.status !== "signing-in" || authChallenge?.attemptId === void 0) return;
				const attemptId = authChallenge.attemptId;
				let stopped = false;
				const poll = async () => {
					try {
						const result = await readAuthAttemptStatus(attemptId);
						if (stopped || !mounted.current) return;
						if (result.status === "succeeded") {
							await refreshAuth();
							return;
						}
						if (result.status === "failed") setAuth({
							status: "error",
							message: t("signInFailed")
						});
						else if (result.status === "cancelled" || result.status === "missing") setAuth({ status: "signed-out" });
					} catch {}
				};
				poll();
				const timer = window.setInterval(() => {
					poll();
				}, 1e3);
				return () => {
					stopped = true;
					window.clearInterval(timer);
				};
			}, [
				auth.status,
				authChallenge?.attemptId,
				open,
				readAuthAttemptStatus,
				refreshAuth,
				t
			]);
			const patchDraft = (models) => {
				setDraft(models);
				setFailure(void 0);
				setNotice(void 0);
			};
			const nextAuthAttempt = () => {
				const attempt = authAttempt.current + 1;
				authAttempt.current = attempt;
				return attempt;
			};
			const liveAuthAttempt = (attempt) => mounted.current && attempt === authAttempt.current;
			const onSignIn = async () => {
				const attempt = nextAuthAttempt();
				setAuthBusy(true);
				setAuthChallenge(void 0);
				setAuth({ status: "signing-in" });
				try {
					const challenge = await startAuth();
					if (liveAuthAttempt(attempt)) setAuthChallenge({
						...challenge.url === void 0 ? {} : { url: challenge.url },
						...challenge.verificationUri === void 0 ? {} : { verificationUri: challenge.verificationUri },
						...challenge.userCode === void 0 ? {} : { userCode: challenge.userCode },
						...challenge.attemptId === void 0 ? {} : { attemptId: challenge.attemptId }
					});
				} catch (error) {
					if (liveAuthAttempt(attempt)) setAuth({
						status: "error",
						message: messageOf(error, t("signInFailed"))
					});
				} finally {
					if (liveAuthAttempt(attempt)) setAuthBusy(false);
				}
			};
			const onCancelAuth = async () => {
				const attempt = nextAuthAttempt();
				setAuthBusy(true);
				try {
					await cancelAuth(authChallenge?.attemptId);
					if (liveAuthAttempt(attempt)) {
						setAuth({ status: "signed-out" });
						setAuthChallenge(void 0);
					}
				} catch (error) {
					if (liveAuthAttempt(attempt)) setAuth({
						status: "error",
						message: messageOf(error, t("signInFailed"))
					});
				} finally {
					if (liveAuthAttempt(attempt)) setAuthBusy(false);
				}
			};
			const onSignOut = async () => {
				const attempt = nextAuthAttempt();
				setAuthBusy(true);
				try {
					await logout();
					if (liveAuthAttempt(attempt)) {
						setAuth({ status: "signed-out" });
						setAuthChallenge(void 0);
						setLastUsage(void 0);
						setUsageUpdatedAt(void 0);
						setRefreshError(void 0);
					}
				} catch (error) {
					if (liveAuthAttempt(attempt)) setAuth({
						status: "error",
						message: messageOf(error, t("signOutFailed"))
					});
				} finally {
					if (liveAuthAttempt(attempt)) setAuthBusy(false);
				}
			};
			const chooseFromOfficial = async () => {
				if (draft === void 0) return;
				const currentModels = draft.map(modelSettingsOf);
				const initiallyPicked = new Set(currentModels.map((model) => model.id));
				setFetching(true);
				setFailure(void 0);
				setNotice(void 0);
				props.beginModelPicker(initiallyPicked, (selected) => {
					setDraft((current) => {
						if (current === void 0) return current;
						const currentById = new Map(current.map((model) => [model.id.trim(), model]));
						const next = /* @__PURE__ */ new Map();
						for (const candidate of selected) {
							const existing = currentById.get(candidate.id);
							const discovered = modelDraftOf(candidate);
							next.set(candidate.id, existing === void 0 ? discovered : {
								...existing,
								...discovered,
								rowId: existing.rowId
							});
						}
						return [...next.values()];
					});
					setCatalogOpen(true);
					setFailure(void 0);
					setNotice(void 0);
				});
				try {
					const found = await fetchModels();
					if (found.length === 0) {
						const message = t("fetchEmpty");
						props.failModelPicker(message);
						setFailure(message);
						return;
					}
					const foundIds = new Set(found.map((model) => model.id));
					const currentOnly = currentModels.filter((model) => !foundIds.has(model.id));
					props.completeModelPicker([...found, ...currentOnly]);
				} catch (error) {
					const message = messageOf(error, t("requestFailed"));
					props.failModelPicker(message);
					setFailure(message);
				} finally {
					setFetching(false);
				}
			};
			const discard = () => {
				if (source !== void 0) setDraft(source.map((model) => ({ ...model })));
				if (snapshot.value !== void 0) setCapabilities(capabilityOf(snapshot.value));
				setFailure(void 0);
				setNotice(void 0);
			};
			const save = async () => {
				if (draft === void 0 || snapshot.value === void 0 || capabilities === void 0 || invalid) return;
				setBusy(true);
				setFailure(void 0);
				setNotice(void 0);
				try {
					const accepted = await props.saveConfiguration({
						...snapshot.value,
						...capabilities,
						models: draft.map(modelSettingsOf)
					});
					const next = accepted.settings.models.map(modelDraftOf);
					setSource(next);
					setDraft(next);
					setCapabilities(capabilityOf(accepted.settings));
					setSourceRevision(accepted.revision);
					setNotice(t("saved"));
				} catch (error) {
					setFailure(messageOf(error, t("requestFailed")));
				} finally {
					setBusy(false);
				}
			};
			const statusLabel = signingIn ? t("signingIn") : auth.status === "signed-in" ? t("signedIn") : auth.status === "reauth-required" ? t("reauthRequired") : auth.status === "error" ? auth.message : auth.status === "loading" ? t("authLoading") : t("signedOut");
			const modelCount = Array.isArray(draft) ? draft.length : snapshot.value?.models?.length ?? 0;
			const headerSummary = formatProviderSummary(auth.status === "signed-in" ? t("summaryOn") : t("summaryOff"), t("summaryModels").replace("{count}", String(modelCount)));
			if (snapshot.status === "unavailable") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
						title,
						mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
						summary: headerSummary,
						open
					})
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: bodyStyle,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: statusStyle$1,
						role: "status",
						children: t("remoteAccess")
					})
				}) : null]
			});
			if (snapshot.status !== "ready" || draft === void 0 || capabilities === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
						title,
						mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
						summary: headerSummary,
						open
					})
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: bodyStyle,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: statusStyle$1,
						children: t("loading")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
						title,
						mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
						summary: headerSummary,
						open,
						unsaved: dirty,
						unsavedLabel: t("unsaved")
					})
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: bodyStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hintStyle,
							children: t("description")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AuthToolbar, {
									status: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: {
											...statusStyle$1,
											margin: 0
										},
										role: "status",
										children: statusLabel
									}),
									action: auth.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: authBusy,
										onClick: () => {
											onSignOut();
										},
										children: t("signOut")
									}) : auth.status === "loading" ? null : auth.status === "signing-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: authBusy,
										onClick: () => {
											onCancelAuth();
										},
										children: t("cancel")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: primaryButtonStyle,
										disabled: authBusy,
										onClick: () => {
											onSignIn();
										},
										children: auth.status === "error" || auth.status === "reauth-required" ? t("signInAgain") : t("signIn")
									})
								}),
								auth.status === "error" || auth.status === "reauth-required" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: errorStyle$1,
									children: auth.message
								}) : null,
								authChallenge !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										flexDirection: "column",
										gap: 8
									},
									children: [authChallenge.userCode === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: hintStyle,
										children: t("deviceInstructions")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeviceCodeRow, {
										code: authChallenge.userCode,
										t
									}, authChallenge.userCode)] }), authChallenge.verificationUri === void 0 ? authChallenge.url === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										href: authChallenge.url,
										target: "_blank",
										rel: "noreferrer",
										children: t("openChatGPT")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										href: authChallenge.verificationUri,
										target: "_blank",
										rel: "noreferrer",
										children: t("openDevicePage")
									})]
								}) : null,
								auth.status === "signed-in" || auth.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										flexDirection: "column",
										gap: 10
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageHeader, {
											title: t("usage"),
											spinning: auth.status === "loading" || quotaRefreshing,
											disabled: auth.status === "loading" || quotaRefreshing,
											refreshLabel: t("usageRefresh"),
											busyLabel: t("usageLoading"),
											...refreshError === void 0 ? {} : { error: refreshError },
											onRefresh: () => {
												refreshAuth(void 0, true);
											}
										}),
										(() => {
											if (quotaRefreshing || auth.status === "loading") {
												const known = lastUsage?.rateLimits.reduce((count, limit) => count + limit.windows.length, 0) ?? 0;
												return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageSkeleton, { rows: known > 0 ? known : 2 });
											}
											const usageView = auth.status === "signed-in" ? auth.usage : lastUsage;
											return usageView === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageSkeleton, { rows: 2 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageLimits, {
												usage: usageView,
												t
											});
										})(),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageUpdatedAt, {
											at: usageUpdatedAt,
											label: usageUpdatedAt === void 0 ? "" : t("usageUpdatedAt").replace("{time}", formatUsageClock(usageUpdatedAt))
										})
									]
								}) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							"aria-label": t("models"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 10
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									style: disclosureStyle,
									"aria-expanded": catalogOpen,
									"aria-label": t("models"),
									onClick: () => {
										setCatalogOpen(!catalogOpen);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { open: catalogOpen }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: sectionTitleStyle,
											children: t("models")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: hintStyle,
											children: customModels ? t("customized") : t("inherited")
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle,
									disabled: disabled || fetching,
									onClick: () => {
										chooseFromOfficial();
									},
									children: fetching ? t("fetchingModels") : t("fetchModels")
								})]
							}), catalogOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SortableList, {
								items: draft,
								getId: (item) => item.rowId,
								disabled,
								dragLabel: (item, index) => {
									const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1);
									return t("dragModel") + ": " + label;
								},
								onReorder: patchDraft,
								renderItem: (item, index) => {
									const expanded = expandedModels.has(item.rowId);
									const label = item.id.trim().length > 0 ? item.id.trim() : String(index + 1);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										"data-model-row": label,
										style: modelContentStyle,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												style: rowInputStyle,
												value: item.id,
												placeholder: t("modelId"),
												"aria-label": t("modelId") + " " + String(index + 1),
												disabled,
												onChange: (event) => {
													patchDraft(draft.map((model, at) => at === index ? {
														...model,
														id: event.target.value
													} : model));
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												style: rowInputStyle,
												value: item.name ?? "",
												placeholder: t("modelName"),
												"aria-label": t("modelName") + " " + String(index + 1),
												disabled,
												onChange: (event) => {
													const name = event.target.value;
													patchDraft(draft.map((model, at) => {
														if (at !== index) return model;
														const next = { ...model };
														if (name.length === 0) delete next.name;
														else next.name = name;
														return next;
													}));
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: iconButtonStyle,
												"aria-label": t("modelDetails") + ": " + label,
												"aria-expanded": expanded,
												title: t("modelDetails"),
												onClick: () => {
													setExpandedModels((current) => {
														const next = new Set(current);
														if (!next.delete(item.rowId)) next.add(item.rowId);
														return next;
													});
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { open: expanded })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: iconButtonStyle,
												disabled,
												"aria-label": t("remove") + " " + label,
												title: t("remove"),
												onClick: () => {
													patchDraft(draft.filter((_, at) => at !== index));
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTrash, {})
											}),
											expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ModelCatalogDetails, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelCatalogRow, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												style: fieldStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: labelStyle,
													children: t("contextWindow")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													style: inputStyle,
													inputMode: "numeric",
													placeholder: officialModelFor(item.id.trim()) === void 0 ? t("contextWindowDefault") : void 0,
													value: item.contextWindow,
													disabled,
													"aria-label": t("contextWindow"),
													onChange: (event) => {
														const contextWindow = event.target.value;
														patchDraft(draft.map((model, at) => at === index ? {
															...model,
															contextWindow
														} : model));
													}
												})]
											}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ModelCatalogCapabilities, { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Capability, {
													label: t("vision"),
													checked: item.vision === true,
													disabled,
													onChange: (checked) => {
														patchDraft(draft.map((model, at) => at === index ? {
															...model,
															vision: checked
														} : model));
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Capability, {
													label: t("thinking"),
													checked: item.thinking === true,
													disabled,
													onChange: (checked) => {
														patchDraft(draft.map((model, at) => {
															if (at !== index) return model;
															const next = {
																...model,
																thinking: checked
															};
															if (!checked) delete next.defaultEffort;
															return next;
														}));
													}
												}),
												(() => {
													const efforts = effortsForCodexModel(modelSettingsOf(item));
													if (efforts.length === 0) return null;
													const suggested = officialModelFor(item.id.trim()) === void 0 ? efforts[0] : defaultCodexReasoningEffort(item.id.trim());
													return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: {
															display: "inline-flex",
															alignItems: "center",
															gap: 6,
															...labelStyle
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: labelStyle,
															children: t("defaultEffort")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
															style: selectStyle,
															value: item.defaultEffort ?? suggested ?? "",
															disabled,
															"aria-label": t("defaultEffort"),
															onChange: (event) => {
																const effort = efforts.find((entry) => entry === event.target.value);
																patchDraft(draft.map((model, at) => {
																	if (at !== index) return model;
																	const next = { ...model };
																	if (effort === void 0) delete next.defaultEffort;
																	else next.defaultEffort = effort;
																	return next;
																}));
															},
															children: efforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: effort,
																children: CODEX_EFFORT_LABELS[effort] ?? effort
															}, effort))
														})]
													});
												})()
											] })] }) : null
										]
									});
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...buttonStyle,
									alignSelf: "flex-start"
								},
								disabled,
								onClick: () => {
									const model = modelDraftOf({
										id: "",
										name: ""
									});
									patchDraft([...draft, model]);
									setExpandedModels((current) => new Set(current).add(model.rowId));
								},
								children: t("addModel")
							})] }) : null]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: sectionTitleStyle,
									children: t("capabilities")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("capabilitiesIntro")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Capability, {
									label: t("enableSearch"),
									checked: capabilities.enableSearch,
									disabled,
									onChange: (checked) => {
										setCapabilities({
											...capabilities,
											enableSearch: checked
										});
										setNotice(void 0);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("enableSearchHelp")
								}),
								capabilities.enableSearch ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: labelStyle,
										children: [t("searchModel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
											style: inputStyle,
											value: capabilities.searchModel,
											disabled,
											onChange: (event) => {
												setCapabilities({
													...capabilities,
													searchModel: event.target.value
												});
												setNotice(void 0);
											},
											children: CODEX_OFFICIAL_MODELS.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: model.id,
												children: model.name
											}, model.id))
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: labelStyle,
										children: [t("searchMode"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											style: inputStyle,
											value: capabilities.searchMode,
											disabled,
											onChange: (event) => {
												setCapabilities({
													...capabilities,
													searchMode: event.target.value
												});
												setNotice(void 0);
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "cached",
													children: t("modeCached")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "indexed",
													children: t("modeIndexed")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "live",
													children: t("modeLive")
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: labelStyle,
										children: [t("searchContextSize"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											style: inputStyle,
											value: capabilities.searchContextSize,
											disabled,
											onChange: (event) => {
												setCapabilities({
													...capabilities,
													searchContextSize: event.target.value
												});
												setNotice(void 0);
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "low",
													children: t("contextLow")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "medium",
													children: t("contextMedium")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "high",
													children: t("contextHigh")
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: labelStyle,
										children: [t("searchMaxOutputTokens"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											style: inputStyle,
											type: "number",
											min: 1,
											step: 1,
											value: capabilities.searchMaxOutputTokens,
											disabled,
											onChange: (event) => {
												setCapabilities({
													...capabilities,
													searchMaxOutputTokens: Number(event.target.value)
												});
												setNotice(void 0);
											}
										})]
									})
								] }) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Capability, {
									label: t("enableImageTool"),
									checked: capabilities.enableImageTool,
									disabled,
									onChange: (checked) => {
										setCapabilities({
											...capabilities,
											enableImageTool: checked
										});
										setNotice(void 0);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("enableImageToolHelp")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Capability, {
									label: t("enableImageGeneration"),
									checked: capabilities.enableImageGeneration,
									disabled,
									onChange: (checked) => {
										setCapabilities({
											...capabilities,
											enableImageGeneration: checked
										});
										setNotice(void 0);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("enableImageGenerationHelp")
								}),
								capabilities.enableImageGeneration ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									style: labelStyle,
									children: [t("imageGenerationModel"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										style: inputStyle,
										value: capabilities.imageGenerationModel,
										disabled,
										onChange: (event) => {
											setCapabilities({
												...capabilities,
												imageGenerationModel: event.target.value
											});
											setNotice(void 0);
										},
										children: imageGenerationPickerModels(capabilities.imageGenerationModel).map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: model.id,
											children: model.name
										}, model.id))
									})]
								}) : null
							]
						}),
						invalidModels ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle$1,
							children: t("invalidModel")
						}) : null,
						invalidCaps && capabilities.searchModel.trim().length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle$1,
							children: t("invalidSearchModel")
						}) : null,
						invalidCaps && capabilities.imageGenerationModel.trim().length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle$1,
							children: t("invalidImageGenerationModel")
						}) : null,
						invalidCaps && capabilities.searchModel.trim().length > 0 && capabilities.imageGenerationModel.trim().length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle$1,
							children: t("invalidSearchTokens")
						}) : null,
						failure !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle$1,
							children: failure
						}) : null,
						notice !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hintStyle,
							children: notice
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: actionsStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle,
								disabled: disabled || !dirty,
								onClick: discard,
								children: t("discard")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: primaryButtonStyle,
								disabled: disabled || !dirty || invalid,
								onClick: () => {
									save();
								},
								children: busy ? t("saving") : t("save")
							})]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/CodexModelPicker.tsx
		/** Frame-level model selection overlay opened by the Codex settings card. */
		/** Shared observable joining the settings card to its frame-level overlay. */
		var CodexModelPickerController = class {
			snapshot = {
				open: false,
				loading: false,
				candidates: [],
				picked: /* @__PURE__ */ new Set()
			};
			listeners = /* @__PURE__ */ new Set();
			onAdopt;
			/** Read the stable snapshot identity until picker state changes. */
			getSnapshot = () => this.snapshot;
			/** Subscribe one renderer listener. */
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/** Open immediately while discovery loads with the current selection captured. */
			begin(onAdopt, initiallyPicked = /* @__PURE__ */ new Set()) {
				this.onAdopt = onAdopt;
				this.publish({
					open: true,
					loading: true,
					candidates: [],
					picked: new Set(initiallyPicked)
				});
			}
			/** Populate an open loading picker, retaining only current ids present in the result. */
			complete(candidates) {
				if (!this.snapshot.open || !this.snapshot.loading) return;
				const candidateIds = new Set(candidates.map((model) => model.id));
				this.publish({
					open: true,
					loading: false,
					candidates: [...candidates],
					picked: new Set([...this.snapshot.picked].filter((id) => candidateIds.has(id)))
				});
			}
			/** Keep the open picker visible with a discovery failure. */
			fail(message) {
				if (!this.snapshot.open || !this.snapshot.loading) return;
				this.publish({
					open: true,
					loading: false,
					candidates: [],
					picked: /* @__PURE__ */ new Set(),
					error: message
				});
			}
			/** Close without adopting any candidate. */
			close = () => {
				this.onAdopt = void 0;
				this.publish({
					open: false,
					loading: false,
					candidates: [],
					picked: /* @__PURE__ */ new Set()
				});
			};
			/** Toggle one candidate by id. */
			toggle = (id) => {
				const picked = new Set(this.snapshot.picked);
				if (picked.has(id)) picked.delete(id);
				else picked.add(id);
				this.publish({
					...this.snapshot,
					picked
				});
			};
			/** Close and deliver the selected candidates to the card. */
			adopt = () => {
				if (this.snapshot.loading || this.snapshot.error !== void 0) return;
				const callback = this.onAdopt;
				const selected = this.snapshot.candidates.filter((model) => this.snapshot.picked.has(model.id));
				this.close();
				callback?.(selected);
			};
			publish(snapshot) {
				this.snapshot = snapshot;
				for (const listener of this.listeners) listener();
			}
		};
		const rootStyle = {
			position: "fixed",
			inset: 0,
			zIndex: 1e3,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			boxSizing: "border-box",
			padding: 24
		};
		const maskStyle = {
			position: "absolute",
			inset: 0,
			background: "var(--dsw-alias-bg-mask-1)",
			backdropFilter: "var(--dsw-mask-blur)"
		};
		const dialogStyle = {
			position: "relative",
			fontFamily: "var(--dsw-font-family)",
			zIndex: 1,
			display: "flex",
			flexDirection: "column",
			width: "min(520px, 100%)",
			maxHeight: "min(680px, calc(100vh - 48px))",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-inverted)",
			borderRadius: 24,
			background: "var(--dsw-alias-bg-layer-2)",
			boxShadow: "var(--dsw-shadow-lv3)",
			color: "var(--dsw-alias-label-primary)"
		};
		const headerStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			padding: "22px 14px 12px 24px"
		};
		const titleStyle = {
			margin: 0,
			fontSize: 16,
			lineHeight: "24px",
			fontWeight: 500
		};
		const closeStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 28,
			height: 28,
			border: 0,
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			cursor: "pointer",
			fontSize: 22
		};
		const descriptionStyle = {
			margin: 0,
			padding: "0 24px",
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-primary)"
		};
		const listStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			minHeight: 0,
			margin: "20px 24px",
			padding: 0,
			overflowY: "auto",
			listStyle: "none"
		};
		const pickerCheckboxStyle = { accentColor: "var(--dsw-alias-brand-primary)" };
		const candidateStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			fontSize: 14,
			lineHeight: "22px",
			cursor: "pointer"
		};
		const statusStyle = {
			display: "flex",
			alignItems: "center",
			minHeight: 96,
			margin: "20px 24px",
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle = {
			...statusStyle,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const footerStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 8,
			padding: "0 24px 24px"
		};
		const outlineButtonStyle = {
			height: 36,
			padding: "0 14px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			cursor: "pointer",
			fontSize: 14
		};
		/** Render the Codex official-catalog picker in the frame overlay layer. */
		function CodexModelPicker(props) {
			const { t } = props;
			const snapshot = props.useCodexModelPicker((value) => value);
			(0, react.useEffect)(() => {
				if (!snapshot.open) return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") props.closePicker();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [snapshot.open, props.closePicker]);
			if (!snapshot.open) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rootStyle,
				role: "presentation",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: maskStyle,
					"aria-hidden": "true",
					onClick: props.closePicker
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: dialogStyle,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("pickerTitle"),
					"aria-busy": snapshot.loading,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: headerStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								style: titleStyle,
								children: t("pickerTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: closeStyle,
								"aria-label": t("close"),
								onClick: props.closePicker,
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: descriptionStyle,
							children: t("pickerDescription")
						}),
						snapshot.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: statusStyle,
							role: "status",
							children: t("pickerLoading")
						}) : snapshot.error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle,
							role: "alert",
							children: snapshot.error
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							style: listStyle,
							children: snapshot.candidates.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: candidateStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									style: pickerCheckboxStyle,
									checked: snapshot.picked.has(model.id),
									onChange: () => {
										props.togglePickerModel(model.id);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.id })]
							}) }, model.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: footerStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: outlineButtonStyle,
								onClick: props.closePicker,
								children: t("cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...outlineButtonStyle,
									...snapshot.loading || snapshot.error !== void 0 ? {
										cursor: "not-allowed",
										opacity: .4
									} : {}
								},
								disabled: snapshot.loading || snapshot.error !== void 0,
								onClick: props.adoptPickerModels,
								children: t("applySelected")
							})]
						})
					]
				})]
			}), document.body);
		}
		//#endregion
		//#region src/client/locales.ts
		/** Localized copy for the Codex Plugin configuration card. */
		const en = {
			title: "Codex",
			description: "Sign in with ChatGPT. This plugin does not use an API key.",
			expand: "Expand settings",
			collapse: "Collapse settings",
			signedOut: "Not signed in.",
			signedIn: "Signed in.",
			signIn: "Sign in with ChatGPT",
			signInAgain: "Sign in again",
			signOut: "Sign out",
			signingIn: "Waiting for ChatGPT authorization…",
			deviceInstructions: "Open the ChatGPT device page in any browser and enter this one-time code.",
			openDevicePage: "Open ChatGPT device page",
			openChatGPT: "Open ChatGPT authorization",
			copyCode: "Copy code",
			copied: "Copied",
			reauthRequired: "Sign in again",
			signInFailed: "Sign-in did not complete. You can try again.",
			signOutFailed: "Could not sign out. Try again.",
			statusFailed: "Could not read sign-in status.",
			authLoading: "Reading sign-in status…",
			loading: "Loading plugin settings…",
			remoteAccess: "A remote browser cannot edit plugin settings. Open this page on the host, or forward the port.",
			models: "Model catalog",
			summaryModels: "{count} models",
			summaryOn: "Signed in",
			summaryOff: "Not signed in",
			unsaved: "Unsaved changes",
			modelDetails: "Details",
			dragModel: "Drag to reorder",
			fetchModels: "Choose from official catalog",
			fetchingModels: "Loading models…",
			fetchEmpty: "No models are available.",
			addModel: "Add model manually",
			modelId: "Model ID",
			modelName: "Display name",
			thinking: "Reasoning",
			vision: "Vision",
			tools: "Tools",
			defaultEffort: "Default thinking",
			contextWindow: "Context window",
			contextWindowDefault: "Provider default",
			remove: "Remove",
			inherited: "Showing the default catalog",
			customized: "Custom catalog",
			discard: "Discard",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			invalidModel: "Every model needs a unique ID.",
			requestFailed: "Request failed.",
			pickerTitle: "Choose models",
			pickerDescription: "Pick which Codex models appear in the conversation selector. Fast and 1M are separate rows.",
			pickerLoading: "Loading models…",
			close: "Close",
			cancel: "Cancel",
			applySelected: "Use selected",
			usage: "Usage limits",
			usageRefresh: "Refresh",
			usageLoading: "Reading usage…",
			fiveHourLimit: "5-hour limit",
			weeklyLimit: "Weekly limit",
			hourLimit: "{count}-hour limit",
			usageWindow: "Usage window",
			percentRemaining: "{percent}% remaining",
			monthlyLimit: "Monthly credit limit",
			exactRemaining: "{remaining} of {limit} credits remaining",
			credits: "Credits",
			unlimited: "Unlimited",
			quotaUnavailable: "Usage limits are temporarily unavailable.",
			usageFailed: "Could not read usage.",
			usageRefreshFailed: "Refresh failed",
			usageUpdatedAt: "Updated {time}",
			usageResetAt: "Resets {time}",
			usageResetAtDays: "Usage limits reset on {date} ({count} days left)",
			capabilities: "Optional capabilities",
			capabilitiesIntro: "These stay off until you enable them. They never change the default model or the global search route.",
			enableSearch: "Enable Codex search provider",
			enableSearchHelp: "Registers Codex as a search provider. It does not select the global search route.",
			searchModel: "Search model",
			searchMode: "Web access",
			modeCached: "Cached",
			modeIndexed: "Indexed",
			modeLive: "Live web",
			searchContextSize: "Search context",
			contextLow: "Low",
			contextMedium: "Medium",
			contextHigh: "High",
			searchMaxOutputTokens: "Maximum search output tokens",
			enableImageTool: "Enable view_image tool",
			enableImageToolHelp: "Allows approved local reads and public-network image fetches for vision-capable models.",
			enableImageGeneration: "Enable codex_generate_image tool",
			enableImageGenerationHelp: "Lets any conversation model draw via ChatGPT Codex (gpt-image-2). Uses this login and Codex usage, typically 3–5× a text turn. Distinct from other generate_image tools.",
			imageGenerationModel: "Image generation model",
			invalidSearchModel: "Enter a search model.",
			invalidSearchTokens: "Maximum search output tokens must be a positive whole number.",
			invalidImageGenerationModel: "Enter an image generation model."
		};
		const zh = {
			title: "Codex",
			description: "使用 ChatGPT 登录。本插件不使用 API key。",
			expand: "展开设置",
			collapse: "折叠设置",
			signedOut: "尚未登录。",
			signedIn: "已登录。",
			signIn: "用 ChatGPT 登录",
			signInAgain: "重新登录",
			signOut: "退出登录",
			signingIn: "正在等待 ChatGPT 授权…",
			deviceInstructions: "请在任意浏览器打开 ChatGPT 设备授权页，并输入下面的一次性代码。",
			openDevicePage: "打开 ChatGPT 设备授权页",
			openChatGPT: "打开 ChatGPT 授权页",
			copyCode: "复制代码",
			copied: "已复制",
			reauthRequired: "需要重新登录",
			signInFailed: "登录未完成。可以重试。",
			signOutFailed: "无法退出登录。请重试。",
			statusFailed: "无法读取登录状态。",
			authLoading: "正在读取登录状态…",
			loading: "正在加载插件设置…",
			remoteAccess: "远程浏览器无法编辑插件设置。请在主机本机打开页面，或先做端口转发。",
			models: "模型目录",
			summaryModels: "{count} 个模型",
			summaryOn: "已登录",
			summaryOff: "未登录",
			unsaved: "未保存的更改",
			modelDetails: "详细设置",
			dragModel: "拖动调整顺序",
			fetchModels: "从官方目录选择",
			fetchingModels: "正在加载模型…",
			fetchEmpty: "没有可用模型。",
			addModel: "手动添加模型",
			modelId: "模型 ID",
			modelName: "显示名称",
			thinking: "推理",
			vision: "视觉",
			tools: "工具",
			defaultEffort: "默认思考",
			contextWindow: "上下文窗口",
			contextWindowDefault: "使用默认值",
			remove: "删除",
			inherited: "使用默认目录",
			customized: "自定义目录",
			discard: "放弃",
			save: "保存",
			saving: "正在保存…",
			saved: "已保存",
			invalidModel: "每个模型都需要唯一的 ID。",
			requestFailed: "请求失败。",
			pickerTitle: "选择模型",
			pickerDescription: "选择要在对话选择器里显示的 Codex 模型。Fast 和 1M 都是单独一行。",
			pickerLoading: "正在加载模型…",
			close: "关闭",
			cancel: "取消",
			applySelected: "使用所选",
			usage: "使用额度",
			usageRefresh: "刷新",
			usageLoading: "正在读取额度…",
			fiveHourLimit: "5 小时额度",
			weeklyLimit: "每周额度",
			hourLimit: "{count} 小时额度",
			usageWindow: "使用额度",
			percentRemaining: "剩余 {percent}%",
			monthlyLimit: "每月信用额度",
			exactRemaining: "剩余 {remaining} / {limit} credits",
			credits: "Credits",
			unlimited: "无限",
			quotaUnavailable: "暂时无法获取使用额度。",
			usageFailed: "无法读取额度。",
			usageRefreshFailed: "刷新失败",
			usageUpdatedAt: "{time} 已更新",
			usageResetAt: "重置时间：{time}",
			usageResetAtDays: "重置时间：{date}（还剩 {count} 天）",
			capabilities: "可选能力",
			capabilitiesIntro: "默认关闭。打开后也不会改默认模型，更不会接管全局搜索路由。",
			enableSearch: "启用 Codex 搜索提供方",
			enableSearchHelp: "让 Codex 可被选作搜索提供方，但不会自动改动全局搜索路由。",
			searchModel: "搜索模型",
			searchMode: "联网方式",
			modeCached: "缓存",
			modeIndexed: "索引",
			modeLive: "实时联网",
			searchContextSize: "搜索上下文",
			contextLow: "低",
			contextMedium: "中",
			contextHigh: "高",
			searchMaxOutputTokens: "搜索最大输出 Tokens",
			enableImageTool: "启用 view_image 工具",
			enableImageToolHelp: "允许具备视觉能力的模型在审批后读取本地图片或获取公网图片。",
			enableImageGeneration: "启用 codex_generate_image 工具",
			enableImageGenerationHelp: "让任意会话模型通过 ChatGPT Codex（gpt-image-2）生图。使用本卡登录和 Codex 额度，大约是普通一轮的 3–5 倍。与其它 generate_image 工具不同名。",
			imageGenerationModel: "生图路由模型",
			invalidSearchModel: "请输入搜索模型。",
			invalidSearchTokens: "搜索最大输出 Tokens 必须是正整数。",
			invalidImageGenerationModel: "请输入生图路由模型。"
		};
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-llm-codex-client";
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		function apply(ctx) {
			const localeNamespace = "settings.codex";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh,
				en
			}), "dsh-llm-codex: Plugin configuration copy");
			const t = ctx.locale.bind(localeNamespace);
			const picker = new CodexModelPickerController();
			const { rpc, isLoopback } = ctx.get("connection");
			let currentSnapshot = {
				status: "loading",
				value: void 0,
				base: void 0,
				user: void 0,
				revision: void 0,
				writable: true,
				mode: "host"
			};
			const listeners = /* @__PURE__ */ new Set();
			const scope = {
				getSnapshot: () => currentSnapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				set: async () => {
					throw new Error("Use Codex management settings/save");
				},
				unset: async () => {
					throw new Error("Use Codex management settings/save");
				}
			};
			const refreshSettings = async () => {
				const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_SETTINGS_READ_ENDPOINT, {});
				if (!result.ok) throw new Error(result.error.message);
				const value = decodeCodexSaveResult(result.value);
				if (value === void 0) throw new Error("invalid settings/read response");
				currentSnapshot = {
					...currentSnapshot,
					status: "ready",
					value: value.settings,
					revision: value.revision
				};
				listeners.forEach((listener) => listener());
			};
			refreshSettings().catch(() => {
				currentSnapshot = {
					...currentSnapshot,
					status: "unavailable"
				};
				listeners.forEach((listener) => listener());
			});
			const readAuthStatus = async (signal) => {
				const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_STATUS_ENDPOINT, {}, signal);
				if (!result.ok) throw new Error(result.error.message);
				const decoded = decodeCodexAuthStatus(result.value);
				if (decoded === void 0) throw new Error("invalid auth status");
				return decoded;
			};
			const startAuth = async () => {
				const authWindow = window.open("about:blank", "_blank");
				if (authWindow !== null) authWindow.opener = null;
				const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_BEGIN_ENDPOINT, { method: isLoopback ? "browser" : "device_code" });
				if (!result.ok) throw new Error(result.error.message);
				const decoded = decodeCodexAuthLoginReply(result.value);
				if (decoded === void 0) throw new Error("invalid auth challenge");
				const destination = decoded.url ?? decoded.verificationUri;
				if (destination !== void 0 && authWindow !== null) authWindow.location.href = destination;
				return decoded;
			};
			const readAuthAttemptStatus = async (attemptId) => {
				const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_ATTEMPT_STATUS_ENDPOINT, { attemptId });
				if (!result.ok) throw new Error(result.error.message);
				const decoded = decodeCodexAuthAttemptStatus(result.value);
				if (decoded === void 0) throw new Error("invalid auth attempt status");
				return decoded;
			};
			const cancelAuth = async (attemptId) => {
				const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_CANCEL_ENDPOINT, { attemptId });
				if (!result.ok) throw new Error(result.error.message);
			};
			const logout = async () => {
				const result = await rpc.call(CODEX_RPC_CHANNEL, CODEX_AUTH_LOGOUT_ENDPOINT, {});
				if (!result.ok || decodeCodexAuthLogoutReply(result.value) === void 0) throw new Error(result.ok ? "invalid logout response" : result.error.message);
			};
			const fetchModels = async () => officialPickerCatalog();
			const saveConfiguration = async (settings) => {
				const snapshot = scope.getSnapshot();
				if (snapshot.revision === void 0) throw new Error(t("requestFailed"));
				const saved = await rpc.call(CODEX_RPC_CHANNEL, CODEX_SAVE_ENDPOINT, {
					models: settings.models,
					enableSearch: settings.enableSearch,
					enableImageTool: settings.enableImageTool,
					enableImageGeneration: settings.enableImageGeneration,
					searchModel: settings.searchModel,
					imageGenerationModel: settings.imageGenerationModel,
					searchMode: settings.searchMode,
					searchContextSize: settings.searchContextSize,
					searchMaxOutputTokens: settings.searchMaxOutputTokens,
					expectedRevision: snapshot.revision
				});
				if (!saved.ok) throw new Error(saved.error.message);
				const accepted = decodeCodexSaveResult(saved.value);
				if (accepted === void 0) throw new Error(t("requestFailed"));
				currentSnapshot = {
					...currentSnapshot,
					status: "ready",
					value: accepted.settings,
					revision: accepted.revision
				};
				listeners.forEach((listener) => listener());
				return accepted;
			};
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "codex-model-picker",
				order: 100,
				inject: () => ({
					t,
					hooks: { codexModelPicker: picker },
					closePicker: picker.close,
					togglePickerModel: picker.toggle,
					adoptPickerModels: picker.adopt
				})
			}, CodexModelPicker));
			ctx.slots.inject("settings.provider.item", () => ctx.slots.register({
				name: "settings.provider.item",
				key: CODEX_SETTINGS_NAMESPACE,
				locale: localeNamespace,
				inject: () => ({
					t,
					hooks: { codexSettings: scope },
					startAuth,
					readAuthStatus,
					cancelAuth,
					readAuthAttemptStatus,
					logout,
					fetchModels,
					saveConfiguration,
					beginModelPicker: (initiallyPicked, onAdopt) => {
						picker.begin(onAdopt, initiallyPicked);
					},
					completeModelPicker: (candidates) => {
						picker.complete(candidates);
					},
					failModelPicker: (message) => {
						picker.fail(message);
					},
					closeModelPicker: picker.close
				})
			}, CodexPluginCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
