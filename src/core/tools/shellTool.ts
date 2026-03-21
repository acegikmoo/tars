import { spawn, exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execPromise = promisify(exec);

function resolveCwd(directory?: string) {
  return directory ? path.resolve(directory) : process.cwd();
}

export interface ShellOptions {
  command: string;
  directory?: string;
  timeout?: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  success: boolean;
  error?: string;
}

export async function execCommand(options: ShellOptions): Promise<ShellResult> {
  const { command, directory, timeout = 30000 } = options;

  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd: resolveCwd(directory),
      timeout,
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode: 0,
      success: true,
    };
  } catch (err) {
    const error = err as any;

    return {
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
      exitCode: typeof error.code === "number" ? error.code : null,
      success: false,
      error: error.message,
    };
  }
}

export function spawnCommand(
  options: ShellOptions,
  onOutput?: (data: string) => void,
): Promise<ShellResult> {
  const { command, directory, timeout } = options;

  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      cwd: resolveCwd(directory),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timeoutId: NodeJS.Timeout | undefined;

    if (timeout) {
      timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
      }, timeout);
    }

    child.stdout?.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      onOutput?.(output);
    });

    child.stderr?.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      onOutput?.(output);
    });

    child.on("close", (code, signal) => {
      if (timeoutId) clearTimeout(timeoutId);

      resolve({
        stdout,
        stderr,
        exitCode: code ?? null,
        success: code === 0,
        error:
          code !== 0
            ? `Command exited with code ${code}${signal ? ` (signal: ${signal})` : ""}`
            : undefined,
      });
    });

    child.on("error", (error) => {
      if (timeoutId) clearTimeout(timeoutId);

      resolve({
        stdout,
        stderr,
        exitCode: null,
        success: false,
        error: error.message,
      });
    });
  });
}
