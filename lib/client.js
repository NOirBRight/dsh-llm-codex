window.__ModuleLoader__.load({
	id: "dsh-llm-codex",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/catalog.ts
		/** Suffix that marks a first-class Fast picker row. */
		const CODEX_FAST_SUFFIX = "-fast";
		/** Documented 1M context budget for official 5.6 large rows. */
		const CODEX_LARGE_CONTEXT_WINDOW = 1e6;
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
		* Split a picker id into the ChatGPT wire id plus Fast / 1M flags.
		* Unknown ids keep historical `-fast` stripping and ignore `-1m`.
		*/
		function parseCodexPickerId(id) {
			let rest = id;
			let fast = false;
			if (rest.endsWith("-fast")) {
				rest = rest.slice(0, -5);
				fast = true;
			}
			let largeContext = false;
			if (rest.endsWith("-1m")) {
				rest = rest.slice(0, -3);
				largeContext = true;
			}
			const official = officialByWireId(rest);
			if (official === void 0) {
				if (id.endsWith("-fast")) return {
					wireId: id.slice(0, -5),
					fast: true,
					largeContext: false
				};
				return {
					wireId: id,
					fast: false,
					largeContext: false
				};
			}
			return {
				wireId: official.id,
				fast,
				largeContext
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
			if (official === void 0) return {
				id: model.id,
				...model.name === void 0 ? {} : { name: model.name },
				...model.description === void 0 ? {} : { description: model.description },
				...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
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
				contextWindow: model.contextWindow ?? (largeContext ? 1e6 : official.contextWindow),
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
		/** Plugin-owned status endpoint consumed by its browser half. */
		const CODEX_AUTH_STATUS_PATH = "/plugins/dsh-llm-codex/auth/status";
		/** Plugin-owned browser-login endpoint consumed by its browser half. */
		const CODEX_AUTH_LOGIN_PATH = "/plugins/dsh-llm-codex/auth/login";
		/** Plugin-owned logout endpoint consumed by its browser half. */
		const CODEX_AUTH_LOGOUT_PATH = "/plugins/dsh-llm-codex/auth/logout";
		const DEFAULT_CODEX_SETTINGS = Object.freeze({
			streamIdleTimeoutMs: CODEX_DEFAULT_STREAM_IDLE_TIMEOUT_MS,
			models: Object.freeze(defaultDisplayedCatalog()),
			enableSearch: false,
			enableImageTool: false,
			searchModel: "gpt-5.6-luna",
			searchMode: "cached",
			searchContextSize: "medium",
			searchMaxOutputTokens: 1e4
		});
		function isRecord$1(value) {
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
			if (!isRecord$1(value) || typeof value["id"] !== "string" || value["id"].trim().length === 0) return void 0;
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
			if (!isRecord$1(value) || hasTokenFields(value)) return void 0;
			const models = decodeModels(value["models"]);
			if (models === void 0) return void 0;
			const streamIdleTimeoutMs = value["streamIdleTimeoutMs"];
			const enableSearch = value["enableSearch"];
			const enableImageTool = value["enableImageTool"];
			const searchModel = value["searchModel"];
			const searchMode = value["searchMode"];
			const searchContextSize = value["searchContextSize"];
			const searchMaxOutputTokens = value["searchMaxOutputTokens"];
			if (streamIdleTimeoutMs !== void 0 && (typeof streamIdleTimeoutMs !== "number" || !Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0)) return;
			if (enableSearch !== void 0 && typeof enableSearch !== "boolean") return void 0;
			if (enableImageTool !== void 0 && typeof enableImageTool !== "boolean") return void 0;
			if (searchModel !== void 0 && (typeof searchModel !== "string" || searchModel.trim().length === 0)) return void 0;
			if (searchMode !== void 0 && searchMode !== "cached" && searchMode !== "indexed" && searchMode !== "live") return;
			if (searchContextSize !== void 0 && searchContextSize !== "low" && searchContextSize !== "medium" && searchContextSize !== "high") return;
			if (searchMaxOutputTokens !== void 0 && (typeof searchMaxOutputTokens !== "number" || !Number.isInteger(searchMaxOutputTokens) || searchMaxOutputTokens < 1)) return;
			return {
				streamIdleTimeoutMs: typeof streamIdleTimeoutMs === "number" ? streamIdleTimeoutMs : DEFAULT_CODEX_SETTINGS.streamIdleTimeoutMs,
				models,
				enableSearch: typeof enableSearch === "boolean" ? enableSearch : DEFAULT_CODEX_SETTINGS.enableSearch,
				enableImageTool: typeof enableImageTool === "boolean" ? enableImageTool : DEFAULT_CODEX_SETTINGS.enableImageTool,
				searchModel: typeof searchModel === "string" ? searchModel.trim() : DEFAULT_CODEX_SETTINGS.searchModel,
				searchMode: searchMode === "indexed" || searchMode === "live" ? searchMode : DEFAULT_CODEX_SETTINGS.searchMode,
				searchContextSize: searchContextSize === "low" || searchContextSize === "high" ? searchContextSize : DEFAULT_CODEX_SETTINGS.searchContextSize,
				searchMaxOutputTokens: typeof searchMaxOutputTokens === "number" ? searchMaxOutputTokens : DEFAULT_CODEX_SETTINGS.searchMaxOutputTokens
			};
		}
		/** Decode a Host save reply. */
		function decodeCodexSaveResult(value) {
			if (!isRecord$1(value) || hasTokenFields(value)) return void 0;
			const settings = decodeCodexSettings(value["settings"]);
			const revision = value["revision"];
			if (settings === void 0 || typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) return;
			return {
				settings,
				revision
			};
		}
		function decodeRateLimitWindow(value) {
			if (!isRecord$1(value) || hasTokenFields(value)) return void 0;
			const remainingPercent = value["remainingPercent"];
			const windowSeconds = value["windowSeconds"];
			if (typeof remainingPercent !== "number" || !Number.isFinite(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) return;
			if (typeof windowSeconds !== "number" || !Number.isFinite(windowSeconds) || windowSeconds <= 0) return;
			return {
				remainingPercent,
				windowSeconds
			};
		}
		function decodeRateLimit(value) {
			if (!isRecord$1(value) || hasTokenFields(value)) return void 0;
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
			if (!isRecord$1(value) || hasTokenFields(value) || typeof value["unlimited"] !== "boolean") return void 0;
			const balance = value["balance"];
			if (balance !== void 0 && (typeof balance !== "string" || balance.length === 0)) return void 0;
			return {
				unlimited: value["unlimited"],
				...balance === void 0 ? {} : { balance }
			};
		}
		function decodeIndividualLimit(value) {
			if (value === void 0) return void 0;
			if (!isRecord$1(value) || hasTokenFields(value)) return void 0;
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
			if (!isRecord$1(value) || hasTokenFields(value) || !Array.isArray(value["rateLimits"])) return void 0;
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
			if (!isRecord$1(value) || hasTokenFields(value)) return void 0;
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
		/** Narrow the Host login reply. Only an http(s) popup URL is accepted. */
		function decodeCodexAuthLoginReply(value) {
			if (!isRecord$1(value) || hasTokenFields(value)) return void 0;
			const url = value["url"];
			if (typeof url !== "string" || url.length === 0) return void 0;
			try {
				const parsed = new URL(url);
				if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return void 0;
			} catch {
				return;
			}
			return { url };
		}
		/** Narrow the Host logout reply. */
		function decodeCodexAuthLogoutReply(value) {
			if (!isRecord$1(value) || hasTokenFields(value) || value["ok"] !== true) return void 0;
			return { ok: true };
		}
		Object.freeze(defaultDisplayedCatalog());
		//#endregion
		//#region src/client/SortableList.tsx
		/** Pointer-driven sortable list with a floating ghost and animated live preview. */
		const listStyle$1 = {
			display: "flex",
			flexDirection: "column",
			gap: 8
		};
		const rowStyle = {
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
			border: 0,
			borderRight: "1px solid var(--dsw-alias-border-l2)",
			padding: 0,
			touchAction: "none",
			userSelect: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const ghostStyle = {
			...rowStyle,
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
		* A small dependency-free sortable surface adapted from CodexHub's
		* SortableList: pointer movement drives a portal ghost and a preview array,
		* while FLIP animations move sibling rows into their prospective positions.
		*/
		function SortableList({ items, getId, renderItem, dragLabel, onReorder, disabled = false }) {
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
				style.textContent = "html.codex-sortable-dragging, html.codex-sortable-dragging * { cursor: grabbing !important; user-select: none !important; }";
				const previousRootCursor = document.documentElement.style.cursor;
				const previousBodyCursor = document.body.style.cursor;
				document.head.appendChild(style);
				document.documentElement.classList.add("codex-sortable-dragging");
				document.documentElement.style.cursor = "grabbing";
				document.body.style.cursor = "grabbing";
				return () => {
					document.documentElement.classList.remove("codex-sortable-dragging");
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
				style: listStyle$1,
				children: [renderedItems.map((item, index) => {
					const id = getId(item);
					const dragging = draggedId === id;
					const targeted = dropTargetId === id && draggedId !== id;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: (node) => {
							setRowRef(id, node);
						},
						"data-sortable-row": "true",
						style: {
							...rowStyle,
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
							style: { minWidth: 0 },
							children: renderItem(item, index)
						})]
					}, id);
				}), dragGhost !== null && draggedItem !== void 0 ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-sortable-ghost": "true",
					style: {
						...ghostStyle,
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
						style: { minWidth: 0 },
						children: renderItem(draggedItem, renderedItems.findIndex((item) => getId(item) === draggedId))
					})]
				}), document.body) : null]
			});
		}
		function sameOrder(left, right, getId) {
			return left.length === right.length && left.every((item, index) => {
				const other = right[index];
				return other !== void 0 && getId(item) === getId(other);
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
		const headerStyle$1 = {
			boxSizing: "border-box",
			width: "100%",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 16,
			border: 0,
			padding: "13px 14px",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
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
		const labelStyle = {
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
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
		const modelContentStyle = {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto auto",
			alignItems: "center",
			gap: 6,
			padding: "6px 8px"
		};
		const modelDetailStyle = {
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 14,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			padding: "10px 4px 4px"
		};
		const checkboxStyle = { accentColor: "var(--dsw-alias-brand-primary)" };
		const barTrackStyle = {
			boxSizing: "border-box",
			height: 8,
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
		function capabilityOf(value) {
			return {
				enableSearch: value.enableSearch,
				enableImageTool: value.enableImageTool,
				searchModel: value.searchModel,
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
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: 6
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									justifyContent: "space-between",
									gap: 10
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: labelStyle,
									children: limit.name ?? label
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: hintStyle,
									children: interpolate(t("percentRemaining"), { percent: formatPercent(remaining) })
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: barTrackStyle,
								role: "progressbar",
								"aria-valuemin": 0,
								"aria-valuemax": 100,
								"aria-valuenow": Math.round(remaining),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
									width: String(remaining) + "%",
									height: "100%",
									display: "block",
									background: "var(--dsw-alias-state-business-primary)"
								} })
							})]
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
			const { t, readAuthStatus, startAuth, logout, fetchModels } = props;
			const snapshot = props.useCodexSettings((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			const initial = (0, react.useMemo)(() => snapshot.value === void 0 ? void 0 : snapshot.value.models.map(modelDraftOf), [snapshot.value]);
			const [source, setSource] = (0, react.useState)(initial);
			const [draft, setDraft] = (0, react.useState)(initial);
			const [capabilities, setCapabilities] = (0, react.useState)(snapshot.value === void 0 ? void 0 : capabilityOf(snapshot.value));
			const [sourceRevision, setSourceRevision] = (0, react.useState)(snapshot.revision);
			const [auth, setAuth] = (0, react.useState)({ status: "loading" });
			const [catalogOpen, setCatalogOpen] = (0, react.useState)(false);
			const [expandedModels, setExpandedModels] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [busy, setBusy] = (0, react.useState)(false);
			const [fetching, setFetching] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const [notice, setNotice] = (0, react.useState)(void 0);
			const mounted = (0, react.useRef)(true);
			const title = t("title");
			const signingIn = auth.status === "signing-in";
			const disabled = snapshot.status !== "ready" || !snapshot.writable || busy;
			const dirtyModels = source !== void 0 && draft !== void 0 && !sameDraft(source, draft);
			const dirtyCaps = snapshot.value !== void 0 && capabilities !== void 0 && JSON.stringify(capabilityOf(snapshot.value)) !== JSON.stringify(capabilities);
			const dirty = dirtyModels || dirtyCaps;
			const invalidModels = draft !== void 0 && modelFailure(draft);
			const invalidCaps = capabilities !== void 0 && (capabilities.searchModel.trim().length === 0 || !Number.isInteger(capabilities.searchMaxOutputTokens) || capabilities.searchMaxOutputTokens < 1);
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
			const refreshAuth = (0, react.useCallback)(async (signal) => {
				try {
					const next = await readAuthStatus(signal);
					if (mounted.current && signal?.aborted !== true) setAuth(next);
				} catch (error) {
					if (mounted.current && signal?.aborted !== true) setAuth({
						status: "error",
						message: messageOf(error, t("statusFailed"))
					});
				}
			}, [readAuthStatus, t]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const controller = new AbortController();
				refreshAuth(controller.signal);
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
			const patchDraft = (models) => {
				setDraft(models);
				setFailure(void 0);
				setNotice(void 0);
			};
			const onSignIn = async () => {
				const popup = window.open("about:blank", "_blank");
				if (popup === null) {
					setAuth({
						status: "error",
						message: t("popupBlocked")
					});
					return;
				}
				popup.opener = null;
				setBusy(true);
				setAuth({ status: "signing-in" });
				try {
					const challenge = await startAuth();
					if (!mounted.current) {
						popup.close();
						return;
					}
					popup.location.replace(challenge.url);
				} catch (error) {
					popup.close();
					if (mounted.current) setAuth({
						status: "error",
						message: messageOf(error, t("signInFailed"))
					});
				} finally {
					if (mounted.current) setBusy(false);
				}
			};
			const onSignOut = async () => {
				setBusy(true);
				try {
					await logout();
					if (mounted.current) setAuth({ status: "signed-out" });
				} catch (error) {
					if (mounted.current) setAuth({
						status: "error",
						message: messageOf(error, t("signOutFailed"))
					});
				} finally {
					if (mounted.current) setBusy(false);
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
			if (snapshot.status === "unavailable") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: {
							display: "flex",
							minWidth: 0,
							flexDirection: "column",
							gap: 3
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 14,
								lineHeight: "20px",
								fontWeight: 600
							},
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 13,
								lineHeight: "18px",
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: t("description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						style: {
							fontSize: 18,
							transform: open ? "rotate(180deg)" : "none"
						},
						children: "⌄"
					})]
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
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: {
							display: "flex",
							minWidth: 0,
							flexDirection: "column",
							gap: 3
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 14,
								lineHeight: "20px",
								fontWeight: 600
							},
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 13,
								lineHeight: "18px",
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: t("description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						style: { fontSize: 18 },
						children: "⌄"
					})]
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
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: {
							display: "flex",
							minWidth: 0,
							flexDirection: "column",
							gap: 3
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 14,
								lineHeight: "20px",
								fontWeight: 600
							},
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 13,
								lineHeight: "18px",
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: t("description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						style: {
							fontSize: 18,
							transform: open ? "rotate(180deg)" : "none"
						},
						children: "⌄"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: bodyStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: 12
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: statusStyle$1,
										role: "status",
										children: statusLabel
									}), auth.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: busy,
										onClick: () => {
											onSignOut();
										},
										children: t("signOut")
									}) : auth.status === "loading" || auth.status === "signing-in" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: primaryButtonStyle,
										disabled: busy,
										onClick: () => {
											onSignIn();
										},
										children: auth.status === "error" || auth.status === "reauth-required" ? t("signInAgain") : t("signIn")
									})]
								}),
								auth.status === "error" || auth.status === "reauth-required" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: errorStyle$1,
									children: auth.message
								}) : null,
								auth.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageLimits, {
									usage: auth.usage,
									...auth.quotaError === void 0 ? {} : { quotaError: auth.quotaError },
									t
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
											expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													...modelDetailStyle,
													gridColumn: "1 / -1"
												},
												children: [
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
													(() => {
														const efforts = effortsForCodexModel(modelSettingsOf(item));
														if (efforts.length === 0) return null;
														const suggested = officialModelFor(item.id.trim()) === void 0 ? efforts[0] : defaultCodexReasoningEffort(item.id.trim());
														return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															style: {
																...labelStyle,
																display: "inline-flex",
																alignItems: "center",
																gap: 6
															},
															children: [t("defaultEffort"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
																style: rowInputStyle,
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
													})(),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: {
															...labelStyle,
															display: "inline-flex",
															alignItems: "center",
															gap: 6
														},
														children: [t("contextWindow"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															style: {
																...rowInputStyle,
																width: 110
															},
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
													})
												]
											}) : null
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
								})
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
						invalidCaps && capabilities.searchModel.trim().length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
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
			signingIn: "Waiting for browser sign-in…",
			reauthRequired: "Sign in again",
			popupBlocked: "The browser blocked the sign-in window. Allow pop-ups for this page and retry.",
			signInFailed: "Sign-in did not complete. You can try again.",
			signOutFailed: "Could not sign out. Try again.",
			statusFailed: "Could not read sign-in status.",
			authLoading: "Reading sign-in status…",
			loading: "Loading plugin settings…",
			remoteAccess: "A remote browser cannot edit plugin settings. Open this page on the host, or forward the port.",
			models: "Model catalog",
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
			invalidSearchModel: "Enter a search model.",
			invalidSearchTokens: "Maximum search output tokens must be a positive whole number."
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
			signingIn: "正在等待浏览器登录…",
			reauthRequired: "需要重新登录",
			popupBlocked: "浏览器阻止了登录窗口。请允许此页面弹出窗口后重试。",
			signInFailed: "登录未完成。可以重试。",
			signOutFailed: "无法退出登录。请重试。",
			statusFailed: "无法读取登录状态。",
			authLoading: "正在读取登录状态…",
			loading: "正在加载插件设置…",
			remoteAccess: "远程浏览器无法编辑插件设置。请在主机本机打开页面，或先做端口转发。",
			models: "模型目录",
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
			invalidSearchModel: "请输入搜索模型。",
			invalidSearchTokens: "搜索最大输出 Tokens 必须是正整数。"
		};
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-llm-codex-client";
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope"
		];
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		async function jsonRequest(path, method, decode, signal) {
			const response = await fetch(path, {
				method,
				headers: { accept: "application/json" },
				credentials: "same-origin",
				...signal === void 0 ? {} : { signal }
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) {
				const message = isRecord(value) && typeof value["error"] === "string" ? value["error"] : "HTTP " + String(response.status);
				throw new Error(message);
			}
			const decoded = decode(value);
			if (decoded === void 0) throw new Error("invalid response");
			return decoded;
		}
		function apply(ctx) {
			const localeNamespace = "settings.codex";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh,
				en
			}), "dsh-llm-codex: Plugin configuration copy");
			const t = ctx.locale.bind(localeNamespace);
			const scope = ctx.settingsScope.bind({
				namespace: CODEX_SETTINGS_NAMESPACE,
				decode: decodeCodexSettings
			});
			const picker = new CodexModelPickerController();
			const { rpc } = ctx.get("connection");
			const readAuthStatus = async (signal) => {
				return jsonRequest(CODEX_AUTH_STATUS_PATH, "GET", decodeCodexAuthStatus, signal);
			};
			const startAuth = async () => {
				return jsonRequest(CODEX_AUTH_LOGIN_PATH, "POST", decodeCodexAuthLoginReply);
			};
			const logout = async () => {
				await jsonRequest(CODEX_AUTH_LOGOUT_PATH, "POST", decodeCodexAuthLogoutReply);
			};
			const fetchModels = async () => officialPickerCatalog();
			const saveConfiguration = async (settings) => {
				const snapshot = scope.getSnapshot();
				if (snapshot.revision === void 0) throw new Error(t("requestFailed"));
				const saved = await rpc.call(CODEX_RPC_CHANNEL, CODEX_SAVE_ENDPOINT, {
					models: settings.models,
					enableSearch: settings.enableSearch,
					enableImageTool: settings.enableImageTool,
					searchModel: settings.searchModel,
					searchMode: settings.searchMode,
					searchContextSize: settings.searchContextSize,
					searchMaxOutputTokens: settings.searchMaxOutputTokens,
					expectedRevision: snapshot.revision
				});
				if (!saved.ok) throw new Error(saved.error.message);
				const accepted = decodeCodexSaveResult(saved.value);
				if (accepted === void 0) throw new Error(t("requestFailed"));
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
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				id: "codex",
				order: 35,
				locale: localeNamespace,
				inject: () => ({
					t,
					hooks: { codexSettings: scope },
					startAuth,
					readAuthStatus,
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
