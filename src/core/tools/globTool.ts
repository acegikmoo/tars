import { glob } from "glob";
import type { ToolResult } from "../../types";

interface GlobOptions {
  pattern: string;
}

export async function globFiles(
  { pattern }: GlobOptions,
  rootDir: string,
  gitIgnoreChecker: (path: string) => boolean,
): Promise<ToolResult> {
  try {
    const results = await glob(pattern, {
      ignore: "node_modules/**",
      cwd: rootDir,
      absolute: true,
    });

    const filteredResults = results.filter(
      (filePath) => !gitIgnoreChecker(filePath),
    );

    if (filteredResults.length === 0) {
      return {
        LLMresult: `No files found matching pattern: ${pattern}`,
        DisplayResult: "No files found",
      };
    }

    return {
      LLMresult: filteredResults.join("\n"),
      DisplayResult: `Found ${filteredResults.length} file(s)`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      LLMresult: `Error searching files: ${errorMsg}`,
      DisplayResult: "Search failed",
    };
  }
}
