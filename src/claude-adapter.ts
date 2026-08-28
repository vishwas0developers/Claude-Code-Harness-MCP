import { spawn } from "child_process";
import { ThinkingMode } from "./config";

export interface ClaudeRunResult {
  success: boolean;
  output: string;
  errorOutput: string;
  exitCode: number | null;
}

// Claude Code CLI has no --thinking flag; extended thinking is triggered by these
// keywords appearing in the prompt text itself. "low" sends no keyword at all.
const THINKING_KEYWORDS: Record<ThinkingMode, string | null> = {
  low: null,
  medium: "think hard",
  high: "ultrathink",
};

// On Windows, `claude` resolves to a .cmd shim, which Node can only launch via
// {shell: true} — and in that mode Node does NOT quote array args for you, it just
// space-joins them. An unquoted multi-word prompt gets torn apart by cmd.exe's own
// parser, so `claude` silently receives only the first word of the task description
// (observed: the rest is dropped and it responds as if given no task at all). Quoting
// each arg ourselves before handing shell:true a single command string fixes this.
function quoteArgForWindowsShell(arg: string): string {
  if (arg.length > 0 && !/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

// Shells out to the local Claude Code CLI in headless/print mode, scoped to
// `cwd`, reusing whatever session `claude /login` already established (no API
// key is ever passed here). ponytail: a single spawned `claude -p` call is the
// whole "adapter" — add queueing/concurrency limits only once real usage shows
// parallel route_task calls actually happen.
export function runClaudeCode(
  prompt: string,
  options: { model: "sonnet" | "opus"; thinkingMode?: ThinkingMode; cwd: string; timeoutMs?: number }
): Promise<ClaudeRunResult> {
  const { model, thinkingMode = "medium", cwd, timeoutMs = 10 * 60 * 1000 } = options;
  const keyword = THINKING_KEYWORDS[thinkingMode];
  const finalPrompt = keyword ? `${keyword}. ${prompt}` : prompt;

  return new Promise((resolve) => {
    // --permission-mode bypassPermissions is required: headless `-p` mode has no TTY to
    // approve tool-use prompts (file writes, bash commands), so without it Claude Code
    // silently stalls/no-ops on any task that needs to touch the filesystem — the task
    // never actually runs. Safe here because every call is already scoped to `cwd`
    // (the caller's project directory) under an authenticated user session, the same
    // trust boundary a human running `claude` in that same directory would have.
    const args = ["-p", finalPrompt, "--model", model, "--permission-mode", "bypassPermissions"];
    // stdin is explicitly ignored: a one-shot `-p` call never needs it, and left as the
    // default open pipe, Claude Code waits ~3s hoping for stdin data before proceeding.
    const isWin = process.platform === "win32";
    const child = isWin
      ? spawn("claude " + args.map(quoteArgForWindowsShell).join(" "), { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] })
      : spawn("claude", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });

    let output = "";
    let errorOutput = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ success: false, output, errorOutput: errorOutput + "\n[harness] timed out", exitCode: null });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.stderr.on("data", (chunk) => (errorOutput += chunk.toString()));

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: false, output, errorOutput: `${errorOutput}\n${err.message}`, exitCode: null });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ success: code === 0, output, errorOutput, exitCode: code });
    });
  });
}

// Best-effort session check: a trivial headless call fails distinctly when the
// CLI isn't authenticated (stderr mentions login/auth) versus other errors.
export async function checkSessionStatus(): Promise<{ authenticated: boolean; detail: string }> {
  const result = await runClaudeCode("Respond with the single word: ok", {
    model: "sonnet",
    thinkingMode: "low",
    cwd: process.cwd(),
    timeoutMs: 30_000,
  });

  if (result.success) {
    return { authenticated: true, detail: "Claude Code CLI session is active." };
  }

  const authIssue = /not logged in|login|unauthenticated|401|403/i.test(result.errorOutput);
  return {
    authenticated: !authIssue,
    detail: authIssue
      ? "Claude Code CLI session appears expired or missing. Run `claude /login` to reauthenticate."
      : `Claude Code CLI call failed: ${result.errorOutput || "unknown error"}`,
  };
}
