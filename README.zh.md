# dsh-llm-codex

[English](README.md) | 中文

DeepSeek Harness 的 ChatGPT Codex 集成。独立提供方路由是 `codex`，设置命名空间是 `llm-codex`。不声明 `apiKeyEnv`，不读写 `~/.codex/auth.json`，也不和 `dsh-codex-connect` 共用凭据文件。

包根导出 Cordis 插件契约。同一产物还导出 `./client`，在「设置 → LLM 供应商」里贡献 Codex 卡片。

## 安装

本版本严格要求 DeepSeek Harness 0.1.2-alpha.4；Alpha.1–Alpha.3 不兼容，Alpha.5 尚未验证。可直接从 GitHub 安装：

~~~sh
dsh plugin --profile web add github:NOirBRight/dsh-llm-codex#v0.3.8
dsh web
~~~

仓库跟踪已构建的 `lib` 产物，GitHub 安装不需要放开 build script。源码检出则先 `pnpm run build`，再做 link 安装。

## 管理 RPC

设置和认证 RPC 使用 Connection 已认证的 `/codex` 通道。远程访问由 Host 的 trusted-host 与 Origin 策略控制；本插件没有单独的远程管理开关。

## Web 配置

打开「设置 → LLM 供应商 → Codex」。**用 ChatGPT 登录**会走官方 ChatGPT OAuth，用系统浏览器打开授权页，并把会话只存在 Host 的 `$DSH_HOME/codex-oauth.json`（权限 `0600`）。登录后卡片显示额度。退出登录会删除该文件。浏览器永远收不到 token。

![Codex 插件卡：ChatGPT 登录、额度与 Fast 目录行](docs/images/plugin-card-catalog.png)

### 模型目录

对话选择器只用 `settings.models` 这份显示目录。默认 6 行：

- `gpt-5.6-sol` / `gpt-5.6-sol-fast`
- `gpt-5.6-terra` / `gpt-5.6-terra-fast`
- `gpt-5.6-luna` / `gpt-5.6-luna-fast`

Fast 和 1M 都是独立选择器行，不是复选框。聊天仍使用官方 wire id；Fast 行发送 `service_tier: "priority"`。1M 行（`gpt-5.6-sol-1m`、`gpt-5.6-sol-1m-fast` 以及 Terra/Luna 对应行）把 `contextWindow` 设为 1,000,000，DSH 压缩仍按默认 80%（800k）触发。它们不在默认 6 行里，需从官方选择器添加。覆盖层还可以加入 `gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.3-codex-spark` 以及 Fast 行。也可以手动添加自定义 id。

选择器 id 还可以用通用上下文后缀 `-<n>k` 或 `-<n>m`（例如 `gpt-5.6-sol-272k` 或 `gpt-5.6-sol-272k-fast`）。插件在发给 ChatGPT 前剥掉该后缀，并用 `n×1000` / `n×1,000,000` 作为 DSH 压缩预算，所以 272K 行会比 1M 行更早开始压缩。`kimi-k3-max` 这类产品名不算档位。Composer picker 按剥后缀后的 base 把兄弟行收成一个家族。

思考等级默认按模型设置，并可在行上改：Luna 用 `max`，Terra 用 `xhigh`，Sol 用 `high`，其他官方 Codex 模型用 `xhigh`。Fast / 1M 行沿用基础型号；会话中用户手动选择的等级优先。

聊天走 pi-ai `openai-codex-responses`，目标是 `https://chatgpt.com/backend-api`。未登录聊天会失败为 `MISSING_CREDENTIAL`。已存会话刷新失败则报 `AUTH`。

### Model Switch 集成

安装 `dsh-model-switch` v0.2+ 后，Codex 会注册复用本插件认证客户端的 Search 与 Image Adapter。Model Switch 保留官方 `web_search` 所有权，也不改变 `view_image` / `codex_generate_image`；不会注册 Vision Adapter。

### 可选能力

搜索、`view_image` 和 `codex_generate_image` 都实现了，但默认关闭。勾选后点保存会立刻注册或卸载，无需重启。打开搜索会注册独立的 Codex `WebSearchProvider`（`POST /codex/alpha/search`）。**不会**写入 `web.searchProvider` 或 `agent-default-model`。搜索模型是官方非 Fast 模型的下拉框，默认 `gpt-5.6-luna`。本插件还会注册 `web/openai-codex-search-llm-request`，以便卸载 `dsh-codex-connect` 后仍能打开它写下的会话日志。搜索模式与官方 Codex 一致：

- `cached`（默认）：只用 OpenAI 维护的索引，不抓当前页面
- `indexed`：仅当搜索索引放行时才 live fetch
- `live`：无限制实时抓取

`view_image` 是模型调用的工具，可读本地文件和公网 HTTP(S) 图片。Spark 只有文本。

`codex_generate_image` 是另一个模型调用工具。任意会话模型都能调用；它使用本插件的 ChatGPT 登录和 Codex 额度（大约是普通一轮的 3–5 倍），后端用 `gpt-image-2` 画画。路由模型下拉列出官方视觉模型，默认 `gpt-5.6-luna`。工具名故意不是 `generate_image`，以免和其它供应商插件撞名。生成文件默认写到 `generated-images/`，也可用 `path` 指定。

![可选的 Codex 搜索与 view_image 能力](docs/images/plugin-card-capabilities.png)

![可选的 Codex 搜索与 view_image 能力](docs/images/plugin-card-capabilities.png)

## 配置

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

bundle 默认对符合条件的模型请求失败最多重试八次。除消息过大 1009 外，带 code/reason 的 ChatGPT WebSocket 关闭、连接上限和过载响应使用可重试的 DSH failure code。token 结构失败使用不可重试的 `AUTH`；含义不明确的 usage limit 仍不可重试。

没有 `apiKeyEnv`，也没有用户可改的 base URL。`models` 是显示在对话选择器里的目录。

## 许可证

MIT

## LLM Providers UI ownership

**LLM 供应商**设置页（`settings.section` `id: providers` 及子槽 `settings.provider.item`）与共享的 `llm-providers` 排序存储完全由 `dsh-llm-providers-ui` 拥有。

- 本插件仅贡献自己的卡片（`key: llm-codex`）和 Host 上的 `llm` 路由；不安装页面或共享命名空间。加载顺序不影响归属。
- 未安装 owner 时（Headless 或 Web 未装 `dsh-llm-providers-ui`）：Host 侧模型路由 `codex` 仍可工作；Web 侧由 owner 决定 Providers 页面与本卡片是否挂载。正式 Web 发版的组合测试会拒绝缺少 owner 的图。
- 导航地球图标为 Alpha.4 临时 DOM 适配器，仅由 `dsh-llm-providers-ui` 持有；本插件不含该适配。

请在 profile 中与 provider 插件一起显式安装 `dsh-llm-providers-ui`（见其 `cordis.patch.yml`）。


## 正式版安装（Latest）

ChatGPT Codex login, model catalog, usage, and optional search/image capabilities. 正式成品只支持 DeepSeek Harness 0.1.2-alpha.4；发布包只包含构建后的 Host/Client 产物，不包含兄弟仓库源码、本机路径或 link:/workspace: 依赖。

LLM Providers 页面、导航和共享排序由 dsh-llm-providers-ui 独占；本插件只提供卡片、模型和 Host 路由。Web 必须先装 Owner，headless 只使用 Host 路由时可以不装 Owner。

Owner（Latest）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui.tgz
~~~

本 Provider（Latest）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/latest/download/dsh-llm-codex.tgz
~~~

固定版本（可复现）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.1.2/dsh-llm-providers-ui.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/download/v0.3.7/dsh-llm-codex.tgz
~~~

更新、卸载与验证：

~~~sh
# 更新到最新 Release
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/latest/download/dsh-llm-codex.tgz
# 验证加载与版本
dsh plugin --profile web list
dsh plugin --profile web doctor
# 只卸载本插件
dsh plugin --profile web remove dsh-llm-codex
~~~

配置入口：Web 使用「设置」中的本插件页面；Host-only 插件使用 profile 的 dsh.profile.bundles 配置。先复制本 README 的最小 YAML/JSON 示例，再填写凭据或后端地址。

回滚：重新执行固定版本 v0.3.7 命令，确认插件列表后只重启一次 Web 服务。失败时查看 journalctl --user -u dsh-web.service 与 dsh plugin --profile web doctor，不要把源码 checkout 写入 production profile。

Release 与完整性：[v0.3.8](https://github.com/NOirBRight/dsh-llm-codex/releases/tag/v0.3.8) · [SHA256SUMS](https://github.com/NOirBRight/dsh-llm-codex/releases/download/v0.3.8/SHA256SUMS)。
