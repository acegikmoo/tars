import type { ToolResult } from "../../types";
import { getErrorMessage } from "../utils";
import * as fs from "fs";
import * as path from "path";

export interface GrepOptions {
  pattern: string;
  path?: string;
  include?: string;
}

interface GrepMatch {
  filePath: string;
  lineNumber: number;
  line: string;
}

export async function grepTool(options: GrepOptions): Promise<ToolResult> {
  const searchPath = options.path ? path.resolve(options.path) : process.cwd();
  const includePattern = options.include ? new RegExp(options.include) : null;
  const matches: GrepMatch[] = [];

  let searchRegex: RegExp;
  try {
    searchRegex = new RegExp(options.pattern);
  } catch (error) {
    return {
      LLMresult: `Invalid regex pattern: ${getErrorMessage(error)}`,
      DisplayResult: "Invalid pattern",
    };
  }

  function searchFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        if (searchRegex.test(line)) {
          matches.push({
            filePath,
            lineNumber: idx + 1,
            line: line.trim(),
          });
        }
      });
    } catch (error) {}
  }

  function walkDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          (entry.name === "node_modules" || entry.name.startsWith("."))
        ) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.match(/\.(jpg|png|gif|pdf|zip|exe|bin)$/i)) {
            continue;
          }

          if (!includePattern || includePattern.test(entry.name)) {
            searchFile(fullPath);
          }
        }
      }
    } catch (error) {}
  }

  try {
    const stat = fs.statSync(searchPath);

    if (stat.isFile()) {
      if (!includePattern || includePattern.test(path.basename(searchPath))) {
        searchFile(searchPath);
      }
    } else if (stat.isDirectory()) {
      walkDir(searchPath);
    } else {
      return {
        LLMresult: `Path is neither a file nor directory: ${searchPath}`,
        DisplayResult: "Invalid path type",
      };
    }
  } catch (error) {
    return {
      LLMresult: `Error accessing path: ${getErrorMessage(error)}`,
      DisplayResult: "Path access failed",
    };
  }

  if (matches.length === 0) {
    return {
      LLMresult: `No matches found for pattern: ${options.pattern}`,
      DisplayResult: "No matches found",
    };
  }

  const maxResults = 1000;
  const limitedMatches = matches.slice(0, maxResults);
  const resultString = limitedMatches
    .map((m) => `${m.filePath}:${m.lineNumber}: ${m.line}`)
    .join("\n");

  const displayMsg =
    matches.length > maxResults
      ? `Found ${matches.length} matches (showing first ${maxResults})`
      : `Found ${matches.length} match(es)`;

  return {
    LLMresult: resultString,
    DisplayResult: displayMsg,
  };
}
