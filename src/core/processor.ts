import { StreamingSpinner } from "./ui/spinner";
import { LLM } from "./llm";
import { ContextManager } from "./contextManager";
import { validateAndRunTool } from "./tools/validateTool";
import { createGitIgnoreChecker } from "./tools/gitIgnoreFileTool";
import type { AgentMode, TaskList } from "../types";
import { loadConfig, type TarsConfig } from "./config";

export interface ProcessorConfig {
  rootDir: string;
  gitIgnoreChecker: (path: string) => boolean;
}

// These tools change files — blocked in ask mode
const MUTATING_TOOLS = ["edit_file", "new_file", "shell_command"];

export class Processor {
  public readonly config: ProcessorConfig;

  private readonly llm: LLM;
  private readonly contextManager: ContextManager;
  private mode: AgentMode = "agent";
  private taskList: TaskList | null = null;
  private messageQueue: string[] = [];

  constructor(rootDir: string, config?: TarsConfig) {
    const cfg = config ?? loadConfig(rootDir);
    const gitIgnoreChecker = createGitIgnoreChecker(rootDir);
    this.config = { rootDir, gitIgnoreChecker };
    this.llm = new LLM(cfg.llm?.model ?? "gemini-2.5-flash");
    this.contextManager = new ContextManager(rootDir, gitIgnoreChecker, cfg);
  }

  setMode(mode: AgentMode) {
    this.mode = mode;
    this.contextManager.setMode(mode); // keep them in sync
  }

  getMode(): AgentMode {
    return this.mode;
  }

  getTaskList(): TaskList | null {
    return this.taskList;
  }

  // Called from UI when user types while AI is working
  enqueueMessage(message: string) {
    this.messageQueue.push(message);
  }

  // For the status bar
  getStatus() {
    return {
      mode: this.mode,
      ...this.contextManager.getStats(),
    };
  }

  private isFinalMessage(response: unknown): response is { text: string } {
    return (
      !!response &&
      !Array.isArray(response) &&
      typeof response === "object" &&
      "text" in response
    );
  }

  pinFile(filePath: string) {
    this.contextManager.pinFile(filePath);
  }

  unpinFile(filePath: string) {
    this.contextManager.unpinFile(filePath);
  }

  getPinnedFiles(): string[] {
    return this.contextManager.getPinnedFiles();
  }

  async processQuery(query: string) {
    this.contextManager.addUserMessage(query);

    const spinner = new StreamingSpinner();
    spinner.start("Thinking...");

    while (true) {
      const prompt = this.contextManager.buildPrompt();
      const rawResponse = await this.llm.streamResponse(prompt, () => {});

      let parsed: any;
      try {
        parsed = this.parseLLMResponse(rawResponse);
      } catch {
        spinner.succeed("Done.");
        break;
      }

      // The AI can call update_task_list to show a checklist
      if (Array.isArray(parsed)) {
        const taskTool = parsed.find((t: any) => t.tool === "update_task_list");
        if (taskTool) {
          this.taskList = taskTool.toolOptions as TaskList;
          // Remove it from the list so it doesn't get sent to validateAndRunTool
          parsed = parsed.filter((t: any) => t.tool !== "update_task_list");
        }
      }

      // Final message: AI is done
      if (this.isFinalMessage(parsed)) {
        spinner.succeed(parsed.text);
        break;
      }

      // Process each tool call
      for (const toolCall of parsed) {
        if (
          !toolCall ||
          typeof toolCall !== "object" ||
          !("tool" in toolCall)
        ) {
          continue;
        }

        // ASK MODE: block any tool that writes/runs things
        if (this.mode === "ask" && MUTATING_TOOLS.includes(toolCall.tool)) {
          this.contextManager.addResponse(
            `[BLOCKED] Cannot use '${toolCall.tool}' in ask mode. User must switch to agent mode.`,
            toolCall,
          );
          continue;
        }

        // PLANNING MODE: same restriction
        if (
          this.mode === "planning" &&
          MUTATING_TOOLS.includes(toolCall.tool)
        ) {
          this.contextManager.addResponse(
            `[BLOCKED] Cannot use '${toolCall.tool}' in planning mode. Only analysis tools are allowed.`,
            toolCall,
          );
          continue;
        }

        spinner.updateText(toolCall.description || "Working...");

        try {
          const result = await validateAndRunTool(
            toolCall,
            {
              LLMConfig: { model: "gemini-2.5-flash" },
              rootDir: this.config.rootDir,
              gitIgnoreChecker: this.config.gitIgnoreChecker,
            },
            this.config.rootDir,
          );

          this.contextManager.addResponse(
            result.result?.LLMresult ?? "",
            toolCall,
          );
        } catch (err) {
          console.error("[AGENT ERROR]", err);
        }

        // Check if user sent a new message while AI was working
        if (this.messageQueue.length > 0) {
          const combined = this.messageQueue.join("\n");
          this.messageQueue = [];
          this.contextManager.addUserMessage(
            `[USER SENT NEW MESSAGE]: ${combined}`,
          );
          break; // restart the loop so AI sees the new message
        }
      }
    }
  }

  private parseLLMResponse(response: string): any {
    let clean = response.trim();
    if (clean.startsWith("```")) {
      clean = clean
        .replace(/^```[a-zA-Z]*\n?/, "")
        .replace(/```$/, "")
        .trim();
    }
    const parsed = JSON.parse(clean);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  }
}
