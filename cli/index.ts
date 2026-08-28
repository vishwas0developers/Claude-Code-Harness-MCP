#!/usr/bin/env node
import { Command } from "commander";
import { PLATFORMS, SUPPORTED_AGENTS, AgentId, installHarness, describeAgent, getSkillDrift } from "../install";
import { ensureConfig, getConfigPath } from "../src/config";

const pkg = require("../../package.json");

const program = new Command();
program.name("claude-code-harness-mcp").description(pkg.description).version(pkg.version);

function parseOnly(only?: string): AgentId[] {
  if (!only) return SUPPORTED_AGENTS as AgentId[];
  const requested = only.split(",").map((s) => s.trim());
  const invalid = requested.filter((r) => !SUPPORTED_AGENTS.includes(r as AgentId));
  if (invalid.length > 0) {
    throw new Error(`Unknown agent(s): ${invalid.join(", ")}. Supported: ${SUPPORTED_AGENTS.join(", ")}.`);
  }
  return requested as AgentId[];
}

program
  .command("setup")
  .description("One-command setup: configures the MCP server + Claude-Harness-MCP skill for every supported agent, and initializes local config.")
  .option("--only <agents>", "Comma-separated list of agent slugs to configure (default: all supported agents)")
  .action((opts) => {
    // ponytail: no presence-detection — every write here is an additive merge (existing
    // MCP entries and skill files for other tools are never touched), so configuring an
    // agent that isn't actually installed on this machine is harmless. Add detection only
    // if the unconditional writes turn out to create noticeable directory clutter.
    const agents = parseOnly(opts.only);

    console.log(`Configuring ${agents.length} agent(s)...\n`);
    for (const agentId of agents) {
      const platform = PLATFORMS.find((p) => p.slug === agentId);
      console.log(`— ${platform ? platform.label : agentId} —`);
      try {
        installHarness(agentId);
      } catch (err: any) {
        console.error(`  ✗ Failed to configure ${agentId}: ${err.message}`);
      }
      console.log("");
    }

    const config = ensureConfig();
    console.log(`✓ Local config ready at ${getConfigPath()} (model: ${config.model})`);
    console.log("\nSetup complete. No further manual steps are required.");
  });

program
  .command("doctor")
  .description("Report (and repair) drift: missing/stale skill files or MCP entries against the currently installed version.")
  .option("--check-only", "Report drift without repairing anything")
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

program.parse(process.argv);
