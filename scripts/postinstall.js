#!/usr/bin/env node
// Runs after `npm install -g claude-code-harness-mcp`. Ensures the Claude Code CLI
// this harness shells out to (`claude -p ...`) is present, installing it if not.
// ponytail: only acts on a global install of this package (npm sets
// npm_config_global=true) — a local `npm install` inside this repo for dev work
// must never trigger a side-effect global install of an unrelated package.
const { spawnSync } = require("child_process");

if (process.env.npm_config_global !== "true") {
  process.exit(0);
}

function hasClaudeCli() {
  const result = spawnSync("claude", ["--version"], { shell: process.platform === "win32", stdio: "ignore" });
  return !result.error && result.status === 0;
}

if (hasClaudeCli()) {
  console.log("✓ Claude Code CLI already installed.");
  process.exit(0);
}

console.log("Claude Code CLI not found — installing @anthropic-ai/claude-code...");
const install = spawnSync("npm", ["install", "-g", "@anthropic-ai/claude-code"], {
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (install.error || install.status !== 0) {
  console.warn(
    "⚠ Could not auto-install the Claude Code CLI. Install it manually:\n" +
      "  npm install -g @anthropic-ai/claude-code\n" +
      "then run `claude /login` before using this harness."
  );
  // Never fail the parent `npm install -g claude-code-harness-mcp` over this.
  process.exit(0);
}

console.log("✓ Claude Code CLI installed. Run `claude /login` to authenticate before using the harness.");
