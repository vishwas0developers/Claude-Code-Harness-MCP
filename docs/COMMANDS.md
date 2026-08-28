# Command Reference

Every command Claude Code Harness MCP ships, in one place — whether it runs in a **terminal**
or inside your **AI agent's chat** as a skill invocation.

| Command | Terminal | Agent | Description |
| :--- | :---: | :---: | :--- |
| `setup <agent>` | ✅ | ❌ | Configure the MCP server + skill for one specific agent. |
| `doctor` | ✅ | ❌ | Report and repair skill/MCP-entry drift, including removing stale pre-rename skill files. |
| `mcp` | ✅ | ❌ | Start the stdio MCP server (invoked automatically by your agent's MCP config, not run by hand). |
| `list-agents` | ✅ | ❌ | Print every supported agent's MCP config path / skill directory, without writing anything. |
| `/Claude-Code-Harness-MCP` | ❌ | ✅ | Verify the current plan, split it into design vs. logic tasks, route logic tasks to Claude Code. |
| `/Claude-Code-Harness-MCP manage model <sonnet\|opus>` | ❌ | ✅ | Change the default model used by `route_task`/`force_claude_task`. |
| `/Claude-Code-Harness-MCP manage thinking <low\|medium\|high>` | ❌ | ✅ | Change the extended-thinking level applied to every Claude Code call. |
| `/Claude-Code-Harness-MCP login` | ❌ | ✅ | Get instructions to authenticate the local Claude Code CLI session. |
| `/Claude-Code-Harness-MCP logout` | ❌ | ✅ | Get instructions to sign out the local Claude Code CLI session. |

**How to run each:**
- **Terminal** (✅ in the Terminal column): run as `claude-code-harness-mcp <command>` (after a
  global install) or `npx claude-code-harness-mcp <command>`.
- **Agent** (✅ in the Agent column): type the slash command shown, inside your AI agent's own
  chat interface — it only works there, not in a terminal.

---

> ### `setup <agent>`
>
> 📌 **Purpose:** Configures the MCP server entry and deploys the `Claude-Code-Harness-MCP`
> skill for one specific agent (see the agent table in
> [README.md](../README.md#-agent-configuration)), and initializes
> `.claude-harness-mcp/config.json` if it doesn't already exist. `<agent>` is required —
> there is no bare `setup` with no argument.
>
> 💻 **Syntax:**
> ```bash
> npx claude-code-harness-mcp setup <agent>
> # e.g. npx claude-code-harness-mcp setup antigravity
> ```
>
> 💡 **Note:** Safe to re-run any time — merges into existing MCP config, never overwrites
> your `model` choice. Run it once per agent you use.

---

> ### `doctor`
>
> 📌 **Purpose:** Report and repair drift — a missing or stale `Claude-Code-Harness-MCP` skill
> file, a version mismatch, or a leftover pre-rename `Claude-Harness-MCP` skill directory from
> an older install — against the currently installed package version.
>
> 💻 **Syntax:**
> ```bash
> claude-code-harness-mcp doctor [--check-only]
> ```
>
> ⚙️ **Options:**
> - `--check-only`: Report drift without repairing anything.

---

> ### `mcp`
>
> 📌 **Purpose:** Start the stdio MCP server. This is what every agent's MCP config
> actually invokes (`args: ["mcp"]`) — you should not need to run it by hand.
>
> 💻 **Syntax:**
> ```bash
> claude-code-harness-mcp mcp
> ```

---

> ### `list-agents`
>
> 📌 **Purpose:** Print every supported agent and the exact MCP config path / skill
> directory `setup` would write to, without writing anything.
>
> 💻 **Syntax:**
> ```bash
> claude-code-harness-mcp list-agents
> ```

---

## Agent skill commands

These run only inside your AI agent's own chat interface, as the `/Claude-Code-Harness-MCP`
skill deployed by `setup`. See [README.md § The Claude-Code-Harness-MCP Skill](../README.md#-the-claude-code-harness-mcp-skill)
for the full behavior each one drives.

> ### `/Claude-Code-Harness-MCP`
>
> 📌 **Purpose:** Verify the current implementation plan (producing one first if missing),
> split it into design/UI tasks and functionality/backend/logic tasks, implement design
> yourself, and call the `route_task` MCP tool for every functionality task.

> ### `/Claude-Code-Harness-MCP manage model <sonnet|opus>`
>
> 📌 **Purpose:** Call the `configure_harness` MCP tool to change the default model used by
> `route_task`/`force_claude_task`. Equivalent to hand-editing `model` in
> `.claude-harness-mcp/config.json`.

> ### `/Claude-Code-Harness-MCP manage thinking <low|medium|high>`
>
> 📌 **Purpose:** Call the `configure_harness` MCP tool to change the extended-thinking level
> applied to every Claude Code call. Equivalent to hand-editing `thinkingMode` in
> `.claude-harness-mcp/config.json`.

> ### `/Claude-Code-Harness-MCP login`
>
> 📌 **Purpose:** Call the `reauthenticate` MCP tool and relay its returned instructions
> (run `claude /login` in a terminal) to re-authenticate an expired Claude Code CLI session.

> ### `/Claude-Code-Harness-MCP logout`
>
> 📌 **Purpose:** Call the `logout` MCP tool and relay its returned instructions (run
> `claude /logout` in a terminal) to sign out the local Claude Code CLI session.

---

## MCP tools

Called automatically by the host agent during normal planning (via the tool descriptions
below), or explicitly by the skill commands above. Not invoked directly by you.

| Tool | Called by | Description |
| :--- | :--- | :--- |
| `route_task` | Host agent / `/Claude-Code-Harness-MCP` | Main entry point — classifies a task and executes it via Claude Code if it's functionality/logic work. |
| `force_claude_task` | Host agent | Bypass classification, send a task straight to Claude Code. |
| `check_session_status` | Host agent | Reports whether the local Claude Code CLI session is authenticated. |
| `reauthenticate` | `/Claude-Code-Harness-MCP login` | Returns instructions to re-authenticate the local Claude Code CLI session. |
| `logout` | `/Claude-Code-Harness-MCP logout` | Returns instructions to sign out the local Claude Code CLI session. |
| `get_task_log` | Host agent | Returns recent routing decisions for audit/debugging. |
| `configure_harness` | `/Claude-Code-Harness-MCP manage model\|thinking` | Reads or updates `model`/`thinkingMode` in `.claude-harness-mcp/config.json`. |

Full tool schemas and the classification rule of thumb live in
[README.md § MCP Tools](../README.md#-mcp-tools).
