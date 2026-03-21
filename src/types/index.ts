export interface ToolResult {
  LLMresult: string;
  DisplayResult: string;
}

export interface ReturnedMessageType {
  text: string;
}

export type AgentMode = "planning" | "agent" | "ask";

export interface TaskItem {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done" | "failed";
}

export interface TaskList {
  goal: string;
  items: TaskItem[];
}
