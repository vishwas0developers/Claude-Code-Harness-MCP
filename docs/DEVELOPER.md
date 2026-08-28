# Claude Code Harness MCP — Developer Documentation

## Architecture

```
┌─────────────────────────────┐
│   Host Agent (Antigravity /  │
│   Copilot / Cursor / etc.)   │
└───────────────┬───────────────┘
                │ MCP protocol (stdio) — via that agent's own mcp.json/config.toml
                ▼
┌─────────────────────────────────────┐
│   claude-code-harness-mcp            │
│  ┌─────────────────────────────────┐ │
│  │ src/classifier.ts  (rule-based) │ │
│  │ src/claude-adapter.ts (spawn)   │ │
│  │ src/config.ts      (model cfg) │ │
│  │ src/log.ts         (task log)  │ │
│  │ src/server.ts      (MCP tools) │ │
│  └─────────────────────────────────┘ │
└───────────────┬───────────────────────┘
                │ spawns `claude -p ... --model <sonnet|opus>`
                ▼
┌─────────────────────────────┐
│   Claude Code CLI (local)    │
│   — authenticated via        │
│     `claude /login`          │
└───────────────────────────────┘
```

`cli/index.ts` is the single Commander.js entry point (`bin: claude-code-harness-mcp`).
`setup`/`doctor`/`list-agents` are plain CLI commands; `mcp` is the same binary invoked
with a different argument to start the long-running stdio MCP server — there is no
runtime auto-detection, the calling agent's own config is what always passes `["mcp"]`.

`install/index.ts` owns the per-agent MCP config paths/formats and the single
`claude-code-harness-mcp` skill definition, using verified config paths and
skills-directory conventions for one skill and one MCP server.

## Configuration Reference

`.claude-harness-mcp/config.json` (project-local):
```json
{ "model": "sonnet", "thinkingMode": "medium" }
```
`thinkingMode` (`low`/`medium`/`high`) maps to the Claude Code CLI's extended-thinking
keywords (`think hard` / `ultrathink`), prepended to the task prompt in `claude-adapter.ts` —
`low` prepends nothing. Both fields are read/written by the `configure_harness` MCP tool,
which backs the `/claude-code-harness-mcp manage model|thinking` skill flow.

`.claude-harness-mcp/task-log.jsonl` (project-local, one JSON object per line):
```json
{"timestamp":"2026-01-01T00:00:00.000Z","taskDescription":"...","classification":"LOGIC_BACKEND","confidence":0.8,"model":"sonnet","durationMs":4210,"success":true}
```

## Classification & Model Routing

`src/classifier.ts` implements the two-stage decision documented in the README:

1. `classifyTask()` — keyword-based signal counting into `DESIGN_UI` / `LOGIC_BACKEND` /
   `AMBIGUOUS`. Deterministic and auditable; no LLM fallback classifier exists yet — the
   PRD calls this out as an optional future addition, not a current requirement.
2. `scoreDifficulty()` — a small set of high-complexity signals (architecture-level,
   multi-file, security-critical, concurrency, or an unusually long task description)
   upgrades routing from the configured default model to `opus`; everything else uses
   whatever `.claude-harness-mcp/config.json` currently says.

## Development

```bash
npm install
npm run build
npm test
```
