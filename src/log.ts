import * as fs from "fs";
import { getLogPath, getConfigDir } from "./config";

export interface TaskLogEntry {
  timestamp: string;
  taskDescription: string;
  classification: string;
  confidence: number;
  model: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export function appendTaskLog(entry: TaskLogEntry, targetDir: string = process.cwd()): void {
  const dir = getConfigDir(targetDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(getLogPath(targetDir), JSON.stringify(entry) + "\n", "utf-8");
}

export function readTaskLog(limit: number = 20, targetDir: string = process.cwd()): TaskLogEntry[] {
  const logPath = getLogPath(targetDir);
  if (!fs.existsSync(logPath)) return [];
  const lines = fs.readFileSync(logPath, "utf-8").trim().split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}
