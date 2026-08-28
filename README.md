# Claude Code Harness MCP

> Model Context Protocol (MCP) server that plugs Claude Code into any MCP-compatible AI coding agent as a dedicated backend/logic sub-agent — the host agent's own model keeps doing design/UI work, and functionality/logic/backend work gets routed to Claude Code, running against your existing Claude Pro/Max subscription.

## What does Claude Code Harness MCP do?

When an AI coding agent (Antigravity, Copilot, Cursor, Windsurf, and friends) plans out a feature, it plans and implements everything itself — including the logic, algorithms, and backend work its own model may not be the strongest at. You can't cleanly hand off just "the functionality half" of a task without manually copy-pasting into a separate Claude Code session and losing all the plan context.

Claude Code Harness MCP fixes that. It runs as a local MCP server that exposes Claude Code as a callable tool. Your host agent keeps planning and keeps doing all UI/design/visual work itself — for every functionality, backend, algorithmic, or data-handling task in its plan, it calls the harness instead of implementing it directly. The harness hands that task to a real headless Claude Code session (scoped to your project directory, authenticated against your Claude subscription) and returns the result — diffs, output, and status — back into the host agent's own workflow.

**Claude Code is strictly a backend/logic sub-agent here.** The harness never receives UI, styling, layout, or visual-design work. Routing is carried two ways at once: the MCP tools' own descriptions (read automatically by every MCP-compatible host) and a single deployed skill invoked the same way everywhere — `/Claude-Code-Harness-MCP` — that tells the host model to split its plan into design vs. functionality before doing anything.

If you find this project useful, consider giving it a ⭐ on GitHub!

📖 **Looking for a specific command?** See the [Full Command Reference](docs/COMMANDS.md) for every terminal command and every `/Claude-Code-Harness-MCP` skill invocation in one place.

---

## 📋 Requirements

Before installing Claude Code Harness MCP, ensure your environment meets the following requirements:

| Component | Required Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `18+` | `node --version` |
| **npm** | `9+` | `npm --version` |
| **Claude Code CLI** | Latest, logged in | `claude --version` / `claude /login` |

> [!NOTE]
> Claude Code Harness MCP shells out to your local Claude Code CLI session — it reuses your existing Pro/Max subscription login, it does **not** use a raw Anthropic API key. Run `claude /login` once before `setup` if you haven't already authenticated Claude Code on this machine.
>
> **Global install auto-installs the CLI too.** `npm install -g claude-code-harness-mcp` checks for `claude` on your PATH and, if it's missing, runs `npm install -g @anthropic-ai/claude-code` for you automatically. You still need to run `claude /login` yourself afterward — auto-install only gets the binary in place, it can't drive the browser-based OAuth flow. `npx claude-code-harness-mcp ...` (no global install) skips this — install the CLI yourself first if you're using the `npx` form.

---

## ⚡ Quick Setup Guide

`setup` always targets one specific agent — there is no bare `claude-code-harness-mcp setup` with no argument. Run the matching command below **inside the AI agent you use** — see the [🔌 Agent Configuration](#-agent-configuration) table for the full list:

```bash
npx claude-code-harness-mcp setup antigravity
```

This one command:
- Writes/merges the `claude-code-harness` MCP server entry into that agent's own MCP config file — using that agent's own config format (JSON merge for most, TOML text-merge for Codex) — without touching any other server already registered there.
- Deploys **one skill**, `Claude-Code-Harness-MCP`, into that agent's own native skills directory. The skill's name and its slash command are the exact same string on every agent — `/Claude-Code-Harness-MCP` — even though the file path it lands at differs per agent (see the table below).
- Initializes `.claude-harness-mcp/config.json` with the default model (`sonnet`) — or preserves it if one already exists.

`setup <agent>` is safe to re-run any time — it merges into existing MCP config rather than overwriting it, and re-deploys the skill to its current version without touching your `model` choice. Run it once per agent you use.

### Install globally (optional)

If you'd rather not prefix every command with `npx`:

```bash
npm install -g claude-code-harness-mcp
claude-code-harness-mcp setup antigravity
```

### Keep it updated

```bash
npm update -g claude-code-harness-mcp
claude-code-harness-mcp doctor
```

`doctor` repairs configuration drift (a stale MCP entry, a stale skill file, a missing config file) against whatever version is currently installed, the same way `setup` does on first run — it never touches your `model` choice or other settings you've changed.

---

## 🔌 Agent Configuration

Run the matching command below **inside the AI agent you use** to configure the MCP server + skill for that agent. Claude Code itself is intentionally not in this list — it's the backend the harness calls, not a host that would route work to it.

| Platform | Command | MCP Config Location | Format | Skills Directory |
| :--- | :--- | :--- | :--- | :--- |
| Google Antigravity | `claude-code-harness-mcp setup antigravity` | `~/.gemini/antigravity-ide/mcp_config.json` | JSON (home-level) | `.agents/skills/` |
| Gemini CLI | `claude-code-harness-mcp setup gemini` | `~/.gemini/config/mcp_config.json` | JSON (home-level) | `.gemini/skills/` |
| Codex | `claude-code-harness-mcp setup codex` | `~/.codex/config.toml` | TOML (home-level, text-merged) | `.codex/skills/` |
| VS Code Copilot Chat | `claude-code-harness-mcp setup vscode` | `.vscode/mcp.json` | JSON | `.agents/skills/` *(generic; unverified for VS Code)* |
| Cursor | `claude-code-harness-mcp setup cursor` | `.cursor/mcp.json` | JSON | `.agents/skills/` *(generic; unverified for Cursor)* |
| Kiro IDE/CLI | `claude-code-harness-mcp setup kiro` | `.kiro/settings/mcp.json` | JSON | `.kiro/skills/` |
| CodeBuddy | `claude-code-harness-mcp setup codebuddy` | `.codebuddy/mcp.json` *(best-effort)* | JSON | `.codebuddy/skills/` |
| OpenCode | `claude-code-harness-mcp setup opencode` | `.opencode/mcp.json` *(best-effort)* | JSON | `.opencode/skills/` |
| Kilo Code | `claude-code-harness-mcp setup kilo` | `.kilo/mcp.json` *(best-effort)* | JSON | `.config/kilo/skills/` |
| GitHub Copilot CLI | `claude-code-harness-mcp setup copilot` | `.copilot/mcp.json` *(best-effort)* | JSON | `.copilot/skills/` |
| OpenClaw | `claude-code-harness-mcp setup claw` | `.claw/mcp.json` *(best-effort)* | JSON | `.openclaw/skills/` |
| Factory Droid | `claude-code-harness-mcp setup droid` | `.droid/mcp.json` *(best-effort)* | JSON | `.factory/skills/` |
| Trae | `claude-code-harness-mcp setup trae` | `.trae/mcp.json` *(best-effort)* | JSON | `.trae/skills/` |
| Trae CN | `claude-code-harness-mcp setup trae-cn` | `.trae-cn/mcp.json` *(best-effort)* | JSON | `.trae-cn/skills/` |
| Hermes | `claude-code-harness-mcp setup hermes` | `.hermes/mcp.json` *(best-effort)* | JSON | `.hermes/skills/` |
| Kimi Code | `claude-code-harness-mcp setup kimi` | `.kimi/mcp.json` *(best-effort)* | JSON | `.kimi/skills/` |
| Amp | `claude-code-harness-mcp setup amp` | `.amp/mcp.json` *(best-effort)* | JSON | `.agents/skills/` |
| Pi coding agent | `claude-code-harness-mcp setup pi` | `.pi/mcp.json` *(best-effort)* | JSON | `.pi/agent/skills/` |
| Devin CLI | `claude-code-harness-mcp setup devin` | `.devin/mcp.json` *(best-effort)* | JSON | `.devin/skills/` |

> [!NOTE]
> **Aider** is excluded — it has no MCP support at all, so there's nothing for `setup` to configure there. The generic **Agent Skills (cross-framework)** fallback identifier is also excluded — it's a skills-only convention name, not a runtime agent that could call an MCP tool.
>
> "Best-effort" MCP paths follow the `.{platform}/mcp.json` shape most MCP-supporting editor forks use, and skills directories marked "generic" fall back to the cross-framework `.agents/skills/` convention. If one doesn't take effect for your version of that agent, please open an issue with the correct location.

---

## 🧠 The `Claude-Code-Harness-MCP` Skill

Every configured agent gets the exact same skill, under the exact same name, invoked the exact same way, regardless of which agent you're in or where the skill file actually lives on disk. It has four invocation forms:

### Primary harness command

```
/Claude-Code-Harness-MCP
```

Run this against your current implementation plan. The host model:

1. **Verifies the plan** — producing one first if none exists yet for the current request.
2. Splits the verified plan into design/UI tasks and functionality/backend/logic tasks.
3. Implements every design/UI task itself — those never go to the harness.
4. Calls `route_task` (see below) for every functionality task, passing along the relevant file/plan context, and applies the returned result.

You don't have to type the slash command for routing to happen — the MCP tool descriptions below are read automatically by the host during normal planning. The skill exists so there's always an explicit, identically-named entry point across every agent when you want to trigger the split-and-route flow on demand.

### Management commands

```
/Claude-Code-Harness-MCP manage model sonnet|opus
/Claude-Code-Harness-MCP manage thinking low|medium|high
```

Reconfigures the harness by calling the `configure_harness` MCP tool — the same effect as hand-editing `.claude-harness-mcp/config.json`, but from inside your agent's chat, the same way you'd run `/model` in Claude Code itself. See [⚙️ Harness Configuration](#-harness-configuration) below for what each value does.

### Login / logout

```
/Claude-Code-Harness-MCP login
/Claude-Code-Harness-MCP logout
```

Calls the `reauthenticate` / `logout` MCP tool and surfaces its returned instructions. Both are informational — the actual `claude /login` / `claude /logout` browser-based flow runs in a terminal you control, not inside the MCP session itself.

---

## 🔧 MCP Tools

| Tool | Description |
| :--- | :--- |
| `route_task` | **Main entry point.** Pass any implementation task from your plan. If it's a functionality/backend/logic task, it's executed by Claude Code and the result is returned. If it reads as UI/design/styling work, it's rejected (`handled: false`) so the host agent implements it itself. |
| `force_claude_task` | Bypass classification — send a task straight to Claude Code regardless of how it reads. Manual override for edge cases. |
| `check_session_status` | Reports whether the local Claude Code CLI session is authenticated, and when it expires. |
| `reauthenticate` | Triggers the Claude Code CLI's browser login flow when a session has expired mid-task. Backs `/Claude-Code-Harness-MCP login`. |
| `logout` | Returns instructions to sign out the local Claude Code CLI session. Backs `/Claude-Code-Harness-MCP logout`. |
| `get_task_log` | Returns recent routing decisions (task, classification, model used, outcome) for audit/debugging. |
| `configure_harness` | Reads or updates the default `model`/`thinking_mode` in `.claude-harness-mcp/config.json`. Called by `/Claude-Code-Harness-MCP manage model\|thinking`. Called with no arguments, it just returns the current config. |

**Classification rule of thumb** (what decides `route_task`'s `handled` result): UI/layout/CSS/styling/animation/responsive/typography work stays with the host agent. Algorithms, APIs, databases, auth logic, state management, business logic, data processing, and bug fixes in logic go to Claude Code. A task that mixes both (e.g. "build a form with validation") is split — the harness only ever takes the logic half.

---

## ⚙️ Harness Configuration

Claude Code Harness MCP defaults to **Sonnet** at **medium** thinking. Change either any time — via `/Claude-Code-Harness-MCP manage model|thinking` (see above) inside your agent, or by hand-editing `.claude-harness-mcp/config.json` in your project root:

```json
{
  "model": "sonnet",
  "thinkingMode": "medium"
}
```

- `model`: `"sonnet"` or `"opus"`. Set `"opus"` for harder, multi-file, or architecture-level tasks.
- `thinkingMode`: `"low"`, `"medium"`, or `"high"`. Maps to the Claude Code CLI's extended-thinking keywords (`think hard` / `ultrathink`) prepended to the task prompt — `"low"` sends none.

Both take effect on the next `route_task`/`force_claude_task` call — no restart of your AI agent required.

---

## 📚 Documentation Links

- **Full Command Reference:** [docs/COMMANDS.md](docs/COMMANDS.md)
- **Developer & Architecture Docs:** [docs/DEVELOPER.md](docs/DEVELOPER.md)
- **License:** [MIT License](LICENSE)

---

## 🤝 Contributing

Contributions are welcome! Have an idea, suggestion, or feature request? Feel free to open a GitHub Issue or start a Discussion.
