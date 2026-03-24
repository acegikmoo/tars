#!/usr/bin/env node
import { program } from "commander";
import dotenv from "dotenv";
import { runCli } from "./core/ui";
import { loadConfig } from "./core/config";

dotenv.config();

const { version } = await import("../package.json");

async function main() {
  program
    .name("tars")
    .description("AI-powered CLI coding assistant")
    .version(version);

  program.action(async () => {
    const rootDir = process.cwd();
    const config = loadConfig(rootDir);
    await runCli(config);
  });

  program.parse();
}

main().catch(console.error);
