import type { ToolResult } from "../../types";
import { z } from "zod";
import { readFile } from "./readFileTool";
import { editFile } from "./editTool";
import { createNewFile } from "./newFileTool";
import { globFiles } from "./globTool";
import { grepTool } from "./grepTool";

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface configType {
  LLMConfig: LLMConfig;
  rootDir: string;
  gitIgnoreChecker: (path: string) => boolean;
}

export type ToolCall =
  | z.infer<typeof ReadFileSchema>
  | z.infer<typeof EditFileSchema>
  | z.infer<typeof NewFileSchema>
  | z.infer<typeof GrepSchema>
  | z.infer<typeof GlobSchema>;

export interface ValidationResult {
  success: boolean;
  data?: ToolCall;
  error?: string;
  result?: ToolResult;
}

export const ReadFileSchema = z.object({
  tool: z.literal("read_file"),
  toolOptions: z.object({
    absolutePath: z.string().min(1, "File path cannot be empty"),
    startLine: z.number().int().min(1, "Line numbers start at 1").optional(),
    endLine: z.number().int().min(1, "Line numbers start at 1").optional(),
  }),
});

export const EditFileSchema = z.object({
  tool: z.literal("edit_file"),
  toolOptions: z.object({
    filePath: z.string().min(1, "File path cannot be empty"),
    oldString: z.string().min(1, "oldString cannot be empty"),
    newString: z.string(),
    expected_replacements: z
      .number()
      .int()
      .min(1, "Must replace at least 1 occurrence")
      .optional(),
  }),
});

export const NewFileSchema = z.object({
  tool: z.literal("new_file"),
  toolOptions: z.object({
    filePath: z.string().min(1, "File path cannot be empty"),
    content: z.string(),
  }),
});

export const GrepSchema = z.object({
  tool: z.literal("grep"),
  toolOptions: z.object({
    pattern: z.string().min(1, "Pattern cannot be empty"),
    path: z.string().optional(),
    include: z.string().optional(),
  }),
});

export const GlobSchema = z.object({
  tool: z.literal("glob"),
  toolOptions: z.object({
    pattern: z.string().min(1, "Pattern cannot be empty"),
  }),
});

function createSuccessResult(
  data: ToolCall,
  result: ToolResult,
): ValidationResult {
  return { success: true, data, result };
}

function createErrorResult(error: string): ValidationResult {
  return { success: false, error };
}

export async function validateAndRunTool(
  jsonData: unknown,
  config: configType,
  rootPath: string,
): Promise<ValidationResult> {
  try {
    if (!jsonData || typeof jsonData !== "object" || !("tool" in jsonData)) {
      return createErrorResult(
        'Invalid tool call format. Expected object with "tool" property. ' +
          'Example: { tool: "read_file", toolOptions: { ... } }',
      );
    }

    const data = jsonData as any;

    switch (data.tool) {
      case "read_file":
        return await handleReadFile(data, rootPath);

      case "edit_file":
        return await handleEditFile(data);

      case "new_file":
        return await handleNewFile(data);

      case "grep":
        return await handleGrep(data, config);

      case "glob":
        return await handleGlob(data, config);

      default:
        return createErrorResult(
          `Unknown tool: "${data.tool}". Supported tools: read_file, edit_file, new_file, grep, glob`,
        );
    }
  } catch (error) {
    return createErrorResult(
      `Unexpected error during tool validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleReadFile(
  data: any,
  rootPath: string,
): Promise<ValidationResult> {
  const parsed = ReadFileSchema.safeParse(data);

  if (!parsed.success) {
    return createErrorResult(
      `Invalid read_file options: ${formatZodError(parsed.error)}`,
    );
  }

  const { startLine, endLine } = parsed.data.toolOptions;

  if (startLine !== undefined && endLine !== undefined) {
    if (startLine > endLine) {
      return createErrorResult(
        `Invalid line range: startLine (${startLine}) cannot be greater than endLine (${endLine})`,
      );
    }
  }

  if (
    (startLine !== undefined && endLine === undefined) ||
    (startLine === undefined && endLine !== undefined)
  ) {
    return createErrorResult(
      "Both startLine and endLine must be provided together, or neither",
    );
  }

  const result = readFile(parsed.data.toolOptions, rootPath);
  return createSuccessResult(parsed.data, result);
}

async function handleEditFile(data: any): Promise<ValidationResult> {
  const parsed = EditFileSchema.safeParse(data);

  if (!parsed.success) {
    return createErrorResult(
      `Invalid edit_file options: ${formatZodError(parsed.error)}`,
    );
  }

  const toolOptions = {
    ...parsed.data.toolOptions,
    expected_replacements: parsed.data.toolOptions.expected_replacements ?? 1,
  };

  const result = editFile(toolOptions);
  return createSuccessResult(parsed.data, result);
}

async function handleNewFile(data: any): Promise<ValidationResult> {
  const parsed = NewFileSchema.safeParse(data);

  if (!parsed.success) {
    return createErrorResult(
      `Invalid new_file options: ${formatZodError(parsed.error)}`,
    );
  }

  const result = await createNewFile({
    filePath: parsed.data.toolOptions.filePath,
    content: parsed.data.toolOptions.content,
  });

  return createSuccessResult(parsed.data, result);
}

async function handleGrep(
  data: any,
  config: configType,
): Promise<ValidationResult> {
  const parsed = GrepSchema.safeParse(data);

  if (!parsed.success) {
    return createErrorResult(
      `Invalid grep options: ${formatZodError(parsed.error)}`,
    );
  }

  const result = await grepTool({
    pattern: parsed.data.toolOptions.pattern,
    path: parsed.data.toolOptions.path,
    include: parsed.data.toolOptions.include,
  });

  return createSuccessResult(parsed.data, result);
}

async function handleGlob(
  data: any,
  config: configType,
): Promise<ValidationResult> {
  const parsed = GlobSchema.safeParse(data);

  if (!parsed.success) {
    return createErrorResult(
      `Invalid glob options: ${formatZodError(parsed.error)}`,
    );
  }

  const result = await globFiles(
    { pattern: parsed.data.toolOptions.pattern },
    config.rootDir,
    config.gitIgnoreChecker,
  );

  return createSuccessResult(parsed.data, result);
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}
