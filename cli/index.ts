#!/usr/bin/env node
import { Command } from "commander";
import { PLATFORMS, SUPPORTED_AGENTS, AgentId, installHarness, describeAgent, getSkillDrift } from "../install";
import { ensureConfig, getConfigPath } from "../src/config";

const pkg = require("../../package.json");

const program = new Command();
program.name("claude-code-harness-mcp").description(pkg.description).version(pkg.version);

program
  .command("setup <agent>")
  .description(`Configures the MCP server + claude-code-harness-mcp skill for one specific agent. Supported: ${SUPPORTED_AGENTS.join(", ")}.`)
  .action((agent: string) => {
    if (!SUPPORTED_AGENTS.includes(agent as AgentId)) {
      console.error(`✗ Unknown agent "${agent}". Supported: ${SUPPORTED_AGENTS.join(", ")}.`);
      process.exitCode = 1;
      return;
    }
    const agentId = agent as AgentId;
    const platform = PLATFORMS.find((p) => p.slug === agentId);
    console.log(`— ${platform ? platform.label : agentId} —`);
    try {
      installHarness(agentId);
    } catch (err: any) {
      console.error(`  ✗ Failed to configure ${agentId}: ${err.message}`);
      process.exitCode = 1;
      return;
    }

    const config = ensureConfig();
    console.log(`\n✓ Local config ready at ${getConfigPath()} (model: ${config.model})`);
    console.log("Setup complete. No further manual steps are required.");
  });

program
  .command("doctor")
  .description("Report (and repair) drift: missing/stale skill files or MCP entries against the currently installed version. Runs with no arguments — `--check-only` below is optional.")
  .option("--check-only", "Report drift without repairing anything (optional)")
  .action((opts) => {
    let staleCount = 0;
    for (const agentId of SUPPORTED_AGENTS as AgentId[]) {
      const drift = getSkillDrift(agentId, process.cwd());
      if (drift.isStale) {
        staleCount++;
        console.log(`✗ ${agentId}: ${drift.reason}`);
        if (!opts.checkOnly) {
          installHarness(agentId);
        }
      }
    }
    if (staleCount === 0) {
      console.log("✓ All configured agents are up to date.");
    } else if (opts.checkOnly) {
      console.log(`\n${staleCount} agent(s) have drift. Run without --check-only to repair.`);
    } else {
      console.log(`\nRepaired ${staleCount} agent(s).`);
    }
  });

program
  .command("mcp")
  .description("Start the stdio MCP server. Invoked automatically by your AI agent's MCP config — do not run manually.")
  .action(() => {
    require("../src/server");
  });

program
  .command("list-agents")
  .description("List every supported agent and where its MCP config / skill would be written.")
  .action(() => {
    for (const { slug } of PLATFORMS) {
      const info = describeAgent(slug as AgentId);
      console.log(`${info.label} (${info.slug})`);
      console.log(`  MCP config: ${info.mcpConfig}`);
      console.log(`  Skill dir:  ${info.skillsDir}`);
    }
  });

program.addHelpText(
  "after",
  `
Agent skill commands (NOT run here — type these inside your AI agent's own chat, after 'setup <agent>' has deployed the skill there):
  /claude-code-harness-mcp start                           Verify the current plan, split it into design vs. logic tasks, route logic tasks to Claude Code via route_task, and verify each result.
  /claude-code-harness-mcp manage model <sonnet|opus>      Change the default model used by route_task/force_claude_task.
  /claude-code-harness-mcp manage thinking <low|medium|high>  Change the extended-thinking level applied to every Claude Code call.
  /claude-code-harness-mcp login                           Get instructions to authenticate the local Claude Code CLI session.
  /claude-code-harness-mcp logout                          Get instructions to sign out the local Claude Code CLI session.

Full reference: https://github.com/manrajidevi91/claude-code-harness-mcp/blob/main/docs/COMMANDS.md
`
);

program.parse(process.argv);
