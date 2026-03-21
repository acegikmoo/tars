import chalk from "chalk";

export class StreamingSpinner {
  private interval: NodeJS.Timeout | null = null;
  private readonly frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private frameIndex = 0;
  private text = "";
  private active = false;

  start(initialText = "Processing...") {
    if (this.active) return;

    this.text = initialText;
    this.active = true;
    this.render();

    this.interval = setInterval(() => {
      if (!this.active) return;

      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, 80);
  }

  updateText(text: string) {
    this.text = text;
    if (this.active) this.render();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.active = false;
    process.stdout.write("\r\x1b[K");
  }

  succeed(text = "Success!") {
    this.stop();
    console.log(chalk.green(text));
  }

  fail(text = "Failed!") {
    this.stop();
    console.log(chalk.red(text));
  }

  private render() {
    process.stdout.write("\r\x1b[K");
    process.stdout.write(
      chalk.cyan(`${this.frames[this.frameIndex]} ${this.text}`),
    );
  }
}
