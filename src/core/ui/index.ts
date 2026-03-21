import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { Processor } from "../processor";
import { showLanding } from "./landing";
import { createPromptSession } from "./prompt";
import { type TarsConfig } from "../config";
import type { AgentMode, TaskList } from "../../types";

export async function runCli(config?: TarsConfig) {
  const rootDir = process.cwd();

  await showLanding();

  const processor = new Processor(rootDir, config);

  const session = createPromptSession();

  console.log(chalk.white.bold("\nChoose a starting mode:"));
  console.log(
    chalk.green("  agent") + chalk.gray("    — execute tasks (default)"),
  );
  console.log(
    chalk.yellow("  planning") + chalk.gray(" — plan without touching files"),
  );
  console.log(chalk.blue("  ask") + chalk.gray("      — read-only Q&A"));

  process.stdout.write(chalk.gray("\nMode (press Enter for agent): "));
  const modeAnswer = await session.ask();

  if (modeAnswer && ["planning", "agent", "ask"].includes(modeAnswer)) {
    processor.setMode(modeAnswer as AgentMode);
    console.log(
      chalk.green(`\n✓ Started in ${modeAnswer.toUpperCase()} mode\n`),
    );
  } else {
    console.log(chalk.green("\n✓ Started in AGENT mode\n"));
  }

  while (true) {
    try {
      const taskList = processor.getTaskList();
      if (taskList) renderTaskList(taskList);

      renderStatusBar(processor);

      process.stdout.write(chalk.cyan("❯ "));
      const query = await session.ask();

      if (query === null) {
        console.log(chalk.yellow("\nGoodbye!\n"));
        process.exit(0);
      }
      if (!query) continue;

      if (query.startsWith(":")) {
        handleCommand(query, processor);
        continue;
      }

      console.log();
      await processor.processQuery(query);
      console.log();
    } catch (error) {
      if (error instanceof Error && error.message.includes("canceled")) {
        console.log(chalk.yellow("\nGoodbye!\n"));
        process.exit(0);
      }
      console.log(chalk.red("\nError:"), error);
    }
  }
}

function renderTaskList(taskList: TaskList) {
  console.log(chalk.bold.white(`\n ${taskList.goal}`));
  for (const item of taskList.items) {
    let icon: string;
    let text: string;

    switch (item.status) {
      case "in-progress":
        icon = chalk.yellow("▶");
        text = chalk.white(item.title);
        break;
      case "done":
        icon = chalk.green("✓");
        text = chalk.gray(item.title);
        break;
      case "failed":
        icon = chalk.red("✗");
        text = chalk.red(item.title);
        break;
      default:
        icon = chalk.gray("○");
        text = chalk.gray(item.title);
    }

    console.log(`    ${icon}  ${text}`);
  }
  console.log();
}

function renderStatusBar(processor: Processor) {
  const status = processor.getStatus();
  const mode = processor.getMode();

  const modeColors: Record<AgentMode, (s: string) => string> = {
    agent: chalk.green,
    planning: chalk.yellow,
    ask: chalk.blue,
  };

  const modeText = modeColors[mode](`[${mode.toUpperCase()}]`);
  const msgs = chalk.gray(`msgs:${status.messageCount}`);
  const tokens = chalk.gray(
    `~${Math.round(status.totalTokens / 100) / 10}k tokens`,
  );
  const hint = chalk.gray("(:help for commands)");

  console.log(`${modeText} ${msgs}  ${tokens}  ${hint}`);
}

function handleCommand(cmd: string, processor: Processor) {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0]!.toLowerCase();

  switch (command) {
    case ":help":
      console.log(chalk.bold("\n  Available commands:\n"));
      console.log(
        `  ${chalk.cyan(":mode")}                    — show current mode`,
      );
      console.log(
        `  ${chalk.cyan(":mode agent")}             — switch to agent mode`,
      );
      console.log(
        `  ${chalk.cyan(":mode planning")}          — switch to planning mode`,
      );
      console.log(
        `  ${chalk.cyan(":mode ask")}               — switch to ask (read-only) mode`,
      );
      console.log(
        `  ${chalk.cyan(":pin <file>")}             — pin file into every prompt`,
      );
      console.log(`  ${chalk.cyan(":unpin <file>")}           — unpin file`);
      console.log(
        `  ${chalk.cyan(":clear")}                   — clear the screen`,
      );
      console.log(`  ${chalk.cyan(":exit")}                    — quit TARS\n`);
      break;

    case ":mode":
      if (parts[1]) {
        const newMode = parts[1] as AgentMode;
        if (["agent", "planning", "ask"].includes(newMode)) {
          processor.setMode(newMode);
          console.log(
            chalk.green(`\n✓ Switched to ${newMode.toUpperCase()} mode\n`),
          );
        } else {
          console.log(
            chalk.red(
              `\n✗ Unknown mode: "${parts[1]}". Use: agent, planning, ask\n`,
            ),
          );
        }
      } else {
        console.log(
          chalk.cyan(`\nCurrent mode: ${processor.getMode().toUpperCase()}\n`),
        );
      }
      break;

    case ":pin": {
      const filePath = parts[1];
      if (!filePath) {
        console.log(chalk.yellow("\nUsage: :pin <relative-file-path>\n"));
        break;
      }
      const abs = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(abs)) {
        console.log(chalk.red(`\nFile not found: ${filePath}\n`));
        break;
      }
      processor.pinFile(abs);
      console.log(chalk.green(`\n✓ Pinned: ${filePath}\n`));
      break;
    }

    case ":unpin": {
      const filePath = parts[1];
      if (!filePath) {
        const pinned = processor.getPinnedFiles();
        if (pinned.length === 0) {
          console.log(chalk.yellow("\nNo files pinned.\n"));
        } else {
          console.log(chalk.cyan("\nPinned files:"));
          pinned.forEach((f) =>
            console.log(`  - ${path.relative(process.cwd(), f)}`),
          );
          console.log();
        }
        break;
      }
      const abs = path.resolve(process.cwd(), filePath);
      processor.unpinFile(abs);
      console.log(chalk.green(`\n✓ Unpinned: ${filePath}\n`));
      break;
    }

    case ":clear":
      console.clear();
      break;

    case ":exit":
    case ":quit":
      console.log(chalk.yellow("\nGoodbye!\n"));
      process.exit(0);

    default:
      console.log(
        chalk.yellow(
          `\nUnknown command: ${cmd}. Type :help to see commands.\n`,
        ),
      );
  }
}
