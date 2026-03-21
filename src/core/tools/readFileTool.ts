import * as fs from "fs";
import * as path from "path";
import type { ToolResult } from "../../types";
import { loadConfig } from "../config";

export interface ReadFileOptions {
  absolutePath: string;
  startLine?: number;
  endLine?: number;
}

export interface ReadFileResult {
  success: boolean;
  content: string;
  lines?: string[];
  size: number;
  path: string;
  error?: string;
  lineRange?: {
    requested: {
      start?: number;
      end?: number;
    };
    actual: {
      start: number;
      end: number;
    };
    totalLines: number;
  };
}

function isBlockedPath(filePath: string, rootPath: string): string | null {
  const config = loadConfig(rootPath);
  const patterns = config.guardrails?.blockReadPatterns ?? [];
  if (patterns.length === 0) return null;

  const base = path.basename(filePath);

  for (const pattern of patterns) {
    // exact match
    if (pattern === base) {
      return `Reading blocked for "${base}" by guardrails.`;
    }
    // prefix wildcard
    if (pattern.startsWith(".") && pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      if (base.startsWith(prefix)) {
        return `Reading blocked for "${base}" by guardrails.`;
      }
    }
    // extension wildcard
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      if (base.endsWith(ext)) {
        return `Reading blocked for "${base}" by guardrails.`;
      }
    }
  }
  return null;
}

export function readFile(
  options: ReadFileOptions,
  rootPath: string,
): ToolResult {
  const blocked = isBlockedPath(options.absolutePath, rootPath);
  if (blocked) {
    return { DisplayResult: "Blocked", LLMresult: blocked };
  }

  const { absolutePath, startLine, endLine } = options;
  const validation = validateFileForReading(absolutePath);
  if (validation) {
    return {
      DisplayResult: "Fixing Issues",
      LLMresult: validation,
    };
  }
  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    if (!startLine && !endLine) {
      return {
        DisplayResult: "Reading " + path.relative(rootPath, absolutePath),
        LLMresult: content,
      };
    } else {
      const lines = content.split("\n");
      const totalLines = lines.length;

      if (startLine === undefined || endLine === undefined) {
        return {
          DisplayResult: "Fixing Issues",
          LLMresult: "Both startLine and endLine must be provided.",
        };
      }
      if (startLine < 1 || endLine < 1) {
        return {
          DisplayResult: "Fixing Issues",
          LLMresult: "startLine and endLine must be greater than 0.",
        };
      }
      if (endLine < startLine) {
        return {
          DisplayResult: "Fixing Issues",
          LLMresult: "endLine must be greater than or equal to startLine.",
        };
      }
      if (totalLines < endLine) {
        return {
          DisplayResult: "Fixing Issues",
          LLMresult: `File only has ${totalLines} lines, but endLine is ${endLine}.`,
        };
      }
      const selectedLines = lines.slice(startLine - 1, endLine);
      const finalContent = selectedLines.join("\n");
      return {
        DisplayResult:
          `Reading lines ${startLine}-${endLine} from ` +
          path.relative(rootPath, absolutePath),
        LLMresult: finalContent,
      };
    }
  } catch (error) {
    console.log("error while reading file:", error);
    return {
      DisplayResult: "Fixing Issues",
      LLMresult: error instanceof Error ? error.message : String(error),
    };
  }
}

export function validateFileForReading(filePath: string): string | null {
  if (!path.isAbsolute(filePath)) {
    return "File path must be absolute";
  }

  if (!fs.existsSync(filePath)) {
    return `File does not exist: ${filePath}`;
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    return `Path is not a file: ${filePath}`;
  }

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    return `File is not readable: ${filePath}`;
  }
  return null;
}
