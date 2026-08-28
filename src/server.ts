import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as path from "path";
import { loadConfig, updateConfig, ThinkingMode } from "./config";
import { classifyTask, scoreDifficulty } from "./classifier";
import { runClaudeCode, checkSessionStatus } from "./claude-adapter";
import { appendTaskLog, readTaskLog } from "./log";

const pkg = require(path.join(__dirname, "..", "..", "package.json"));

const server = new Server(
  { name: "claude-code-harness", version: pkg.version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "route_task",
        description:
          "Send an implementation task here ONLY if it is functionality/backend/logic work: algorithms, APIs, databases, auth logic, state management, business logic, data processing, or a bug fix in logic. If the task is UI/design/styling/layout/animation/typography work, do NOT call this tool - implement it yourself. Runs the task through a local Claude Code session and returns its output.",
        inputSchema: {
          type: "object",
          properties: {
            task_description: { type: "string", description: "The functionality task to implement" },
            file_context: { type: "string", description: "Relevant file paths or code snippets, optional" },
            project_path: { type: "string", description: "Absolute path to the project directory (default: current directory)" },
          },
          required: ["task_description"],
        },
      },
      {
        name: "force_claude_task",
        description: "Bypass classification and send a task straight to Claude Code regardless of how it reads. Manual override for edge cases.",
        inputSchema: {
          type: "object",
          properties: {
            task_description: { type: "string" },
            file_context: { type: "string" },
            project_path: { type: "string" },
            model_hint: { type: "string", enum: ["sonnet", "opus"] },
          },
          required: ["task_description"],
        },
      },
      {
        name: "check_session_status",
        description: "Check whether the local Claude Code CLI session is authenticated.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "reauthenticate",
        description: "Get instructions to re-authenticate the local Claude Code CLI session after it has expired. Also backs the /Claude-Code-Harness-MCP login skill flow.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "logout",
        description: "Get instructions to sign out the local Claude Code CLI session. Backs the /Claude-Code-Harness-MCP logout skill flow.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_task_log",
        description: "Return recent routing decisions (task, classification, model used, outcome) for audit/debugging.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "number", description: "Max entries to return (default 20)" } },
        },
      },
      {
        name: "configure_harness",
        description:
          "Read or update harness configuration (default model, thinking mode). Called by the /Claude-Code-Harness-MCP manage model|thinking flow. Call with no arguments to just read the current config.",
        inputSchema: {
          type: "object",
          properties: {
            model: { type: "string", enum: ["sonnet", "opus"], description: "Default model used by route_task" },
            thinking_mode: { type: "string", enum: ["low", "medium", "high"], description: "Extended-thinking level applied to every Claude Code call" },
            project_path: { type: "string", description: "Absolute path to the project directory (default: current directory)" },
          },
        },
      },
    ],
  };
});

async function executeOnClaude(
  taskDescription: string,
  fileContext: string | undefined,
  projectPath: string,
  model: "sonnet" | "opus",
  thinkingMode: ThinkingMode
) {
  const prompt = fileContext
    ? `${taskDescription}\n\nRelevant context:\n${fileContext}`
    : taskDescription;
  return runClaudeCode(prompt, { model, thinkingMode, cwd: projectPath });
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();

  try {
    switch (name) {
      case "route_task": {
        const taskDescription = String(args?.task_description);
        const projectPath = args?.project_path ? String(args.project_path) : process.cwd();
        const fileContext = args?.file_context ? String(args.file_context) : undefined;

        const { classification, confidence, matchedDesignKeywords, matchedLogicKeywords } =
          classifyTask(taskDescription);

        if (classification === "DESIGN_UI" || classification === "AMBIGUOUS") {
          const result = {
            handled: false,
            reasoning: `Classified as ${classification} (design keywords: [${matchedDesignKeywords.join(", ")}], logic keywords: [${matchedLogicKeywords.join(", ")}]). Implement this yourself.`,
          };
          appendTaskLog(
            { timestamp: new Date().toISOString(), taskDescription, classification, confidence, model: "none", durationMs: Date.now() - startTime, success: true },
            projectPath
          );
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        const config = loadConfig(projectPath);
        const model = scoreDifficulty(taskDescription) === "opus" ? "opus" : config.model;
        const runResult = await executeOnClaude(taskDescription, fileContext, projectPath, model, config.thinkingMode);

        appendTaskLog(
          {
            timestamp: new Date().toISOString(),
            taskDescription,
            classification,
            confidence,
            model,
            durationMs: Date.now() - startTime,
            success: runResult.success,
            error: runResult.success ? undefined : runResult.errorOutput,
          },
          projectPath
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  handled: true,
                  reasoning: `Classified as LOGIC_BACKEND (confidence ${confidence.toFixed(2)}). Executed via Claude Code (${model}).`,
                  result: runResult.output,
                  success: runResult.success,
                  error: runResult.success ? undefined : runResult.errorOutput,
                },
                null,
                2
              ),
            },
          ],
          isError: !runResult.success,
        };
      }

      case "force_claude_task": {
        const taskDescription = String(args?.task_description);
        const projectPath = args?.project_path ? String(args.project_path) : process.cwd();
        const fileContext = args?.file_context ? String(args.file_context) : undefined;
        const config = loadConfig(projectPath);
        const model = (args?.model_hint as "sonnet" | "opus") || config.model;

        const runResult = await executeOnClaude(taskDescription, fileContext, projectPath, model, config.thinkingMode);

        appendTaskLog(
          {
            timestamp: new Date().toISOString(),
            taskDescription,
            classification: "FORCED",
            confidence: 1,
            model,
            durationMs: Date.now() - startTime,
            success: runResult.success,
            error: runResult.success ? undefined : runResult.errorOutput,
          },
          projectPath
        );

        return {
          content: [{ type: "text", text: JSON.stringify({ result: runResult.output, success: runResult.success, error: runResult.success ? undefined : runResult.errorOutput }, null, 2) }],
          isError: !runResult.success,
        };
      }

      case "check_session_status": {
        const status = await checkSessionStatus();
        return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
      }

      case "reauthenticate": {
        const result = {
          instructions: "Run `claude /login` in a terminal to open the browser-based login flow, then retry your last task.",
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "logout": {
        const result = {
          instructions: "Run `claude /logout` in a terminal to sign out the local Claude Code CLI session. Run `/Claude-Code-Harness-MCP login` (or `claude /login`) again before the next route_task/force_claude_task call.",
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_task_log": {
        const limit = args?.limit !== undefined ? Number(args.limit) : 20;
        const entries = readTaskLog(limit);
        return { content: [{ type: "text", text: JSON.stringify({ entries }, null, 2) }] };
      }

      case "configure_harness": {
        const projectPath = args?.project_path ? String(args.project_path) : process.cwd();
        const updates: { model?: "sonnet" | "opus"; thinkingMode?: ThinkingMode } = {};
        if (args?.model) updates.model = args.model as "sonnet" | "opus";
        if (args?.thinking_mode) updates.thinkingMode = args.thinking_mode as ThinkingMode;

        const config = Object.keys(updates).length > 0 ? updateConfig(updates, projectPath) : loadConfig(projectPath);
        return { content: [{ type: "text", text: JSON.stringify({ config }, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ message: err.message }, null, 2) }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error running MCP Stdio Server:", error);
  process.exit(1);
});
