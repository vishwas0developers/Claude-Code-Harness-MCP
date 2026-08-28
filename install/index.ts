import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const pkg = require(path.join(__dirname, "..", "..", "package.json"));

// Every host agent this harness routes FROM. Claude Code itself is deliberately absent —
// it's the backend the harness calls, not a host that would route work to it. Aider is
// absent too (no MCP support at all), and the generic cross-framework "agents" skills
// fallback is absent (not a runtime agent that could call an MCP tool).
export const PLATFORMS: { slug: string; label: string }[] = [
  { slug: "antigravity", label: "Google Antigravity" },
  { slug: "gemini", label: "Gemini CLI" },
  { slug: "codex", label: "Codex" },
  { slug: "vscode", label: "VS Code Copilot Chat" },
  { slug: "cursor", label: "Cursor" },
  { slug: "kiro", label: "Kiro IDE/CLI" },
  { slug: "codebuddy", label: "CodeBuddy" },
  { slug: "opencode", label: "OpenCode" },
  { slug: "kilo", label: "Kilo Code" },
  { slug: "copilot", label: "GitHub Copilot CLI" },
  { slug: "claw", label: "OpenClaw" },
  { slug: "droid", label: "Factory Droid" },
  { slug: "trae", label: "Trae" },
  { slug: "trae-cn", label: "Trae CN" },
  { slug: "hermes", label: "Hermes" },
  { slug: "kimi", label: "Kimi Code" },
  { slug: "amp", label: "Amp" },
  { slug: "pi", label: "Pi coding agent" },
  { slug: "devin", label: "Devin CLI" },
];

export const SUPPORTED_AGENTS = PLATFORMS.map((p) => p.slug);
export type AgentId = (typeof SUPPORTED_AGENTS)[number];

// Verified/documented MCP config paths per agent. Everything else falls back to `.{slug}/mcp.json`.
const VERIFIED_MCP_TARGETS: Partial<Record<AgentId, (targetDir: string) => string>> = {
  vscode: (targetDir) => path.join(targetDir, ".vscode", "mcp.json"),
  cursor: (targetDir) => path.join(targetDir, ".cursor", "mcp.json"),
  gemini: () => path.join(os.homedir(), ".gemini", "config", "mcp_config.json"),
  antigravity: () => path.join(os.homedir(), ".gemini", "antigravity-ide", "mcp_config.json"),
  kiro: (targetDir) => path.join(targetDir, ".kiro", "settings", "mcp.json"),
};

// Verified native skill directories. Antigravity and Amp both read project skills from
// the generic cross-framework `.agents/skills/` location.
const VERIFIED_SKILLS_TARGETS: Partial<Record<AgentId, (targetDir: string) => string>> = {
  codebuddy: (targetDir) => path.join(targetDir, ".codebuddy", "skills"),
  codex: (targetDir) => path.join(targetDir, ".codex", "skills"),
  opencode: (targetDir) => path.join(targetDir, ".opencode", "skills"),
  kilo: (targetDir) => path.join(targetDir, ".config", "kilo", "skills"),
  copilot: (targetDir) => path.join(targetDir, ".copilot", "skills"),
  claw: (targetDir) => path.join(targetDir, ".openclaw", "skills"),
  droid: (targetDir) => path.join(targetDir, ".factory", "skills"),
  trae: (targetDir) => path.join(targetDir, ".trae", "skills"),
  "trae-cn": (targetDir) => path.join(targetDir, ".trae-cn", "skills"),
  gemini: (targetDir) => path.join(targetDir, ".gemini", "skills"),
  hermes: (targetDir) => path.join(targetDir, ".hermes", "skills"),
  kimi: (targetDir) => path.join(targetDir, ".kimi", "skills"),
  kiro: (targetDir) => path.join(targetDir, ".kiro", "skills"),
  pi: (targetDir) => path.join(targetDir, ".pi", "agent", "skills"),
  devin: (targetDir) => path.join(targetDir, ".devin", "skills"),
  amp: (targetDir) => path.join(targetDir, ".agents", "skills"),
  antigravity: (targetDir) => path.join(targetDir, ".agents", "skills"),
};

function displayPath(absolutePath: string): string {
  const home = os.homedir();
  const normalized = absolutePath.startsWith(home) ? "~" + absolutePath.slice(home.length) : absolutePath;
  return normalized.split(path.sep).join("/");
}

export function resolveSkillsDir(agentId: AgentId, targetDir: string): string {
  const verified = VERIFIED_SKILLS_TARGETS[agentId];
  if (verified) return verified(targetDir);
  return path.join(targetDir, ".agents", "skills");
}

export function resolveMcpConfigPath(agentId: AgentId, targetDir: string): string {
  if (agentId === "codex") return path.join(os.homedir(), ".codex", "config.toml");
  const verified = VERIFIED_MCP_TARGETS[agentId];
  if (verified) return verified(targetDir);
  return path.join(targetDir, `.${agentId}`, "mcp.json");
}

const MCP_SERVER_NAME = "claude-code-harness";
const BIN_NAME = "claude-code-harness-mcp";

// Merges the harness's stdio MCP server entry into the given JSON config file,
// preserving any other servers already registered there.
function writeMcpServerConfig(mcpConfigPath: string): void {
  const mcpDir = path.dirname(mcpConfigPath);
  if (!fs.existsSync(mcpDir)) fs.mkdirSync(mcpDir, { recursive: true });

  let mcpConfig: any = { mcpServers: {} };
  if (fs.existsSync(mcpConfigPath)) {
    try {
      mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
    } catch {
      // Empty/invalid config — start fresh
    }
  }
  if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

  mcpConfig.mcpServers[MCP_SERVER_NAME] = {
    type: "stdio",
    command: BIN_NAME,
    args: ["mcp"],
  };

  fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
  console.log(`✓ Configured MCP server: ${mcpConfigPath}`);
}

// Codex reads TOML. Append a `[mcp_servers.claude-code-harness]` table if one isn't
// already present — a plain-text merge, sufficient for a single well-known entry.
function writeCodexMcpConfig(configPath: string): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let existing = "";
  if (fs.existsSync(configPath)) existing = fs.readFileSync(configPath, "utf-8");

  if (existing.includes(`[mcp_servers.${MCP_SERVER_NAME}]`)) {
    console.log(`✓ MCP server already configured: ${configPath}`);
    return;
  }

  const entry = `\n[mcp_servers.${MCP_SERVER_NAME}]\ncommand = "${BIN_NAME}"\nargs = ["mcp"]\n`;
  fs.writeFileSync(configPath, existing.trimEnd() + "\n" + entry, "utf-8");
  console.log(`✓ Configured MCP server: ${configPath}`);
}

// A single skill, deployed under the exact same name/slash-command on every agent —
// see README.md "The Claude-Code-Harness-MCP Skill". ponytail: one shared skill file instead
// of workspace-sync's six, because this harness only has one workflow to teach.
export const SKILL_NAME = "Claude-Code-Harness-MCP";

export const SKILL_CONTENT = `---
name: Claude-Code-Harness-MCP
description: "Verify the current implementation plan, split it into design/UI work and functionality/backend/logic work, do design yourself and route functionality to the Claude Code harness. Also handles /Claude-Code-Harness-MCP manage model|thinking, login, and logout."
---

# Claude Code Harness

This skill has four invocation forms:

- \`/Claude-Code-Harness-MCP\` — run the harness workflow against your current implementation plan.
- \`/Claude-Code-Harness-MCP manage model <sonnet|opus>\` or \`/Claude-Code-Harness-MCP manage thinking <low|medium|high>\` — reconfigure the harness. See "Management mode" below.
- \`/Claude-Code-Harness-MCP login\` — re-authenticate the local Claude Code CLI session.
- \`/Claude-Code-Harness-MCP logout\` — sign out the local Claude Code CLI session.

## Harness workflow (default invocation)

1. **Verify there is an implementation plan.** If you (the host model) have not yet produced
   one for the current request, produce it first — do not proceed on a vague or missing plan.
2. Break the verified plan into individual tasks.
3. For each task, decide: is this UI/design/visual work, or functionality/backend/logic work?
   - UI/design signals: layout, CSS/styling, color, animation, responsive behavior, typography,
     component visual structure, design tokens.
   - Functionality signals: algorithms, APIs, databases, auth logic, state management,
     business logic, data processing, bug fixes in logic, performance, tests.
4. Implement every design/UI task yourself, using your own model.
5. For every functionality task, call the \`route_task\` MCP tool from the
   \`claude-code-harness\` server with the task description and relevant file/project context.
   It runs the task through a local Claude Code session and returns the result — apply
   the returned diff/output as you would your own.
6. If a single task mixes both (e.g. "a form with validation"), split it: implement the
   UI shell yourself, send only the validation/logic function to \`route_task\`.

### Notes

- \`route_task\` will itself refuse (\`handled: false\`) anything that reads as design work —
  treat that as confirmation to implement it yourself, not an error.
- Use \`force_claude_task\` only to override classification deliberately.
- If \`route_task\`/\`force_claude_task\` reports an expired Claude Code session, surface the
  \`reauthenticate\` instructions to the user rather than retrying silently.

## Management mode (\`manage model\` / \`manage thinking\`)

When invoked as \`manage model <value>\` or \`manage thinking <value>\`:

1. Parse \`<value>\` from the invocation text.
   - \`model\` accepts exactly: \`sonnet\`, \`opus\`.
   - \`thinking\` accepts exactly: \`low\`, \`medium\`, \`high\`.
2. Call the \`configure_harness\` MCP tool from the \`claude-code-harness\` server with
   \`{ "model": "<value>" }\` or \`{ "thinking_mode": "<value>" }\` accordingly.
3. Report back the tool's returned config as confirmation. Do not guess at a value the user
   didn't provide — if \`<value>\` is missing or invalid, call \`configure_harness\` with no
   arguments to show the current config instead of defaulting silently.

## Login / logout

- \`/Claude-Code-Harness-MCP login\`: call the \`reauthenticate\` MCP tool and relay its
  returned instructions to the user verbatim.
- \`/Claude-Code-Harness-MCP logout\`: call the \`logout\` MCP tool and relay its returned
  instructions to the user verbatim.

Both are instructional, not automatic — the actual browser-based OAuth flow runs in a
terminal the user controls, not inside this MCP session.
`;

export function installHarness(agentId: AgentId, targetDir: string = process.cwd()): void {
  if (!SUPPORTED_AGENTS.includes(agentId)) {
    throw new Error(`Unknown agent "${agentId}". Supported agents: ${SUPPORTED_AGENTS.join(", ")}.`);
  }

  const mcpConfigPath = resolveMcpConfigPath(agentId, targetDir);
  if (agentId === "codex") {
    writeCodexMcpConfig(mcpConfigPath);
  } else {
    writeMcpServerConfig(mcpConfigPath);
  }

  const skillsDir = resolveSkillsDir(agentId, targetDir);

  // Renamed from "Claude-Harness-MCP" — remove the old directory so agents don't
  // show both as separate skill/slash-command entries side by side.
  const staleDir = path.join(skillsDir, "Claude-Harness-MCP");
  if (fs.existsSync(staleDir)) {
    fs.rmSync(staleDir, { recursive: true, force: true });
    console.log(`✓ Removed stale skill: ${staleDir}`);
  }

  const skillDir = path.join(skillsDir, SKILL_NAME);
  if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), SKILL_CONTENT.trim() + "\n", "utf-8");
  fs.writeFileSync(path.join(skillsDir, ".claude-harness-mcp-version"), pkg.version, "utf-8");
  console.log(`✓ Skill configured at: ${skillDir}`);
}

export function describeAgent(agentId: AgentId, targetDir: string = process.cwd()) {
  const platform = PLATFORMS.find((p) => p.slug === agentId);
  return {
    slug: agentId,
    label: platform ? platform.label : agentId,
    mcpConfig: displayPath(resolveMcpConfigPath(agentId, targetDir)),
    skillsDir: displayPath(resolveSkillsDir(agentId, targetDir)),
  };
}

export interface SkillDrift {
  agentId: AgentId;
  isStale: boolean;
  reason: string;
}

// Used by `doctor` to detect a missing/modified skill file or version stamp drift
// against the currently installed package version.
export function getSkillDrift(agentId: AgentId, targetDir: string): SkillDrift {
  const skillsDir = resolveSkillsDir(agentId, targetDir);
  const skillFile = path.join(skillsDir, SKILL_NAME, "SKILL.md");
  const versionStamp = path.join(skillsDir, ".claude-harness-mcp-version");

  if (fs.existsSync(path.join(skillsDir, "Claude-Harness-MCP"))) {
    return { agentId, isStale: true, reason: "stale pre-rename skill (Claude-Harness-MCP) still present" };
  }
  if (!fs.existsSync(skillFile)) {
    return { agentId, isStale: true, reason: "skill not installed" };
  }
  const onDisk = fs.readFileSync(skillFile, "utf-8");
  if (onDisk !== SKILL_CONTENT.trim() + "\n") {
    return { agentId, isStale: true, reason: "skill content out of date" };
  }
  if (!fs.existsSync(versionStamp) || fs.readFileSync(versionStamp, "utf-8").trim() !== pkg.version) {
    return { agentId, isStale: true, reason: "version stamp out of date" };
  }
  return { agentId, isStale: false, reason: "" };
}
