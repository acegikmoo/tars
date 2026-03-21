import { streamText, type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import chalk from "chalk";

export class LLM {
  private readonly model: LanguageModel;

  constructor(model: string) {
    this.assertApiKey();
    this.model = google(`models/${model}`);
  }

  private assertApiKey() {
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return;

    console.error(chalk.red("Missing API Key!\n"));
    console.error(chalk.yellow("Please set your Google AI API key:\n"));
    console.error(
      chalk.cyan("export GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here\n"),
    );
    console.error(
      chalk.blue("Get your API key at: https://aistudio.google.com/app/apikey"),
    );

    process.exit(1);
  }

  async streamResponse(
    prompt: string,
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    try {
      const { textStream } = streamText({
        model: this.model,
        prompt,
      });

      let fullResponse = "";

      for await (const chunk of textStream) {
        fullResponse += chunk;
        onChunk ? onChunk(chunk) : process.stdout.write(chunk);
      }

      return fullResponse;
    } catch (err: any) {
      this.handleAuthError(err);
      throw err;
    }
  }

  private handleAuthError(error: any) {
    const msg = error?.message?.toLowerCase?.() ?? "";

    if (msg.includes("api key") || msg.includes("authentication")) {
      console.error(chalk.red("\nAuthentication Error!"));
      console.error(chalk.yellow("Please verify your Google AI API key."));
      console.error(chalk.blue("https://aistudio.google.com/app/apikey"));
      process.exit(1);
    }
  }
}
