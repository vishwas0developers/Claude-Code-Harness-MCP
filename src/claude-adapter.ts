import { spawn } from "child_process";

export interface ClaudeRunResult {
  success: boolean;
  output: string;
  errorOutput: string;
  exitCode: number | null;
}

// Shells out to the local Claude Code CLI in headless/print mode, scoped to
// `cwd`, reusing whatever session `claude /login` already established (no API
// key is ever passed here). ponytail: a single spawned `claude -p` call is the
// whole "adapter" — add queueing/concurrency limits only once real usage shows
// parallel route_task calls actually happen.
export function runClaudeCode(
  prompt: string,
  options: { model: "sonnet" | "opus"; cwd: string; timeoutMs?: number }
): Promise<ClaudeRunResult> {
  const { model, cwd, timeoutMs = 10 * 60 * 1000 } = options;

  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", prompt, "--model", model], {
      cwd,
      shell: process.platform === "win32",
    });

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
