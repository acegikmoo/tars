import * as fs from "fs";
import * as path from "path";

export interface TarsConfig {
  llm: {
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  features?: {
    fileTreeMaxDepth?: number;
    maxContextTokens?: number;
    allowDangerous?: boolean;
    confirmEdits?: boolean;
  };
  guardrails?: {
    blockReadPatterns?: string[];
  };
}

export const DEFAULT_CONFIG: TarsConfig = {
  llm: {
    model: "gemini-2.5-flash",
  },
  features: {
    allowDangerous: false,
    confirmEdits: false,
    maxContextTokens: 20000,
  },
  guardrails: {
    blockReadPatterns: [
      ".env",
      ".env.*",
      "*.pem",
      "*.key",
      "id_rsa",
      "id_ed25519",
      ".npmrc",
    ],
  },
};

export function getConfigPath(rootDir: string) {
  return path.join(rootDir, ".tars.json");
}

export function loadConfig(rootDir: string): TarsConfig {
  const configPath = getConfigPath(rootDir);
  if (!fs.existsSync(configPath)) return cloneConfig(DEFAULT_CONFIG);
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch {
    return cloneConfig(DEFAULT_CONFIG);
  }
}

export function saveConfig(rootDir: string, config: TarsConfig) {
  const configPath = getConfigPath(rootDir);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function mergeConfig(base: TarsConfig, overrides: any): TarsConfig {
  return {
    llm: {
      model: overrides?.llm?.model ?? base.llm.model,
      temperature: overrides?.llm?.temperature ?? base.llm.temperature,
      maxTokens: overrides?.llm?.maxTokens ?? base.llm.maxTokens,
    },
    features: {
      fileTreeMaxDepth:
        overrides?.features?.fileTreeMaxDepth ??
        base.features?.fileTreeMaxDepth,
      maxContextTokens:
        overrides?.features?.maxContextTokens ??
        base.features?.maxContextTokens,
      allowDangerous:
        overrides?.features?.allowDangerous ?? base.features?.allowDangerous,
      confirmEdits:
        overrides?.features?.confirmEdits ?? base.features?.confirmEdits,
    },
    guardrails: {
      blockReadPatterns:
        overrides?.guardrails?.blockReadPatterns ??
        base.guardrails?.blockReadPatterns,
    },
  };
}

function cloneConfig(config: TarsConfig): TarsConfig {
  return JSON.parse(JSON.stringify(config));
}
