import * as fs from "fs";
import * as path from "path";

export interface HarnessConfig {
  model: "sonnet" | "opus";
}

const DEFAULT_CONFIG: HarnessConfig = { model: "sonnet" };

export function getConfigDir(targetDir: string = process.cwd()): string {
  return path.join(targetDir, ".claude-harness-mcp");
}

export function getConfigPath(targetDir: string = process.cwd()): string {
  return path.join(getConfigDir(targetDir), "config.json");
}

// Creates the default config file if absent; never overwrites an existing one.
export function ensureConfig(targetDir: string = process.cwd()): HarnessConfig {
  const configPath = getConfigPath(targetDir);
  if (fs.existsSync(configPath)) {
    return loadConfig(targetDir);
  }
  fs.mkdirSync(getConfigDir(targetDir), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
  return { ...DEFAULT_CONFIG };
}

export function loadConfig(targetDir: string = process.cwd()): HarnessConfig {
  const configPath = getConfigPath(targetDir);
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function getLogPath(targetDir: string = process.cwd()): string {
  return path.join(getConfigDir(targetDir), "task-log.jsonl");
}
