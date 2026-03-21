import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import readline from "readline";

const HISTORY_FILE = path.join(os.homedir(), ".tars_history");
const MAX_HISTORY = 200;

export interface PromptSession {
  ask(): Promise<string | null>;
  close(): void;
}

export function createPromptSession(): PromptSession {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: MAX_HISTORY,
    completer: (line: string) => {
      const commands = [
        ":help",
        ":mode",
        ":mode agent",
        ":mode planning",
        ":mode ask",
        ":clear",
        ":exit",
      ];
      const hits = commands.filter((c) => c.startsWith(line));
      return [hits.length ? hits : commands, line];
    },
  });

  loadHistory(rl);

  rl.on("SIGINT", () => {
    console.log("\nGoodbye!\n");
    process.exit(0);
  });

  return {
    async ask(): Promise<string | null> {
      const value = await question(rl);
      if (value === null) return null;
      const trimmed = value.trim();
      if (trimmed.length > 0) appendHistory(trimmed);
      return trimmed;
    },
    close() {
      rl.close();
    },
  };
}

function question(rl: readline.Interface): Promise<string | null> {
  return new Promise((resolve) => {
    rl.question("", (answer) => resolve(answer));
  });
}

function loadHistory(rl: readline.Interface) {
  if (!fs.existsSync(HISTORY_FILE)) return;
  try {
    const lines = fs
      .readFileSync(HISTORY_FILE, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    (rl as any).history = lines.slice(-MAX_HISTORY).reverse();
  } catch {
    // ignore
  }
}

function appendHistory(line: string) {
  try {
    fs.appendFileSync(HISTORY_FILE, `${line}\n`);
  } catch {
    // ignore
  }
}
