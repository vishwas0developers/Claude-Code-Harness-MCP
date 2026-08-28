# Command Reference

All commands run as `claude-code-harness-mcp <command>` (after a global install) or
`npx claude-code-harness-mcp <command>`.

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
> file, or a version mismatch — against the currently installed package version.
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
