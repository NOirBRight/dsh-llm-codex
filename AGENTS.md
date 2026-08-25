# DSH 两套平面

3080 / `~/.dsh` 是 production，只读发布面。不要为了预览去改、刷新、重启 3080。
3082 / `~/.dsh-lab` 是唯一试验面。改插件只动 Workstation checkout，验收只看 3082。
完整约定：`/home/noirbright/Workstation/AGENTS.md`

## Core 边界

本项目只维护插件：官方 DeepSeek Harness 及其本地 checkout 是只读依赖。实现与兼容处理留在本项目；禁止修改或要求 DSH core patch。缺少公开 seam 时记录上游提案，并让插件在干净的官方 tag 上降级或关闭该能力。
