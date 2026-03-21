export const toolRegistry = [
  {
    name: "edit_file",
    description: `Replaces text within a file using exact string matching. Always read the file first to see current content.

CRITICAL REQUIREMENTS:
- filePath: Must be absolute (starts with /)
- oldString: Exact literal text to replace - include 3+ lines of context before/after for unique matching
- newString: Exact replacement text - ensure correct indentation and syntax
- NEVER escape strings - copy directly from read_file output

Single replacement (default): Fails if multiple matches exist to prevent ambiguity.
Multiple replacements: Set expected_replacements to replace all exact matches.

The user can modify newString content - this will be noted in the response if it happens.`,
    toolOptions: {
      filePath: {
        description: "Absolute path to file (must start with '/')",
        type: String,
      },
      oldString: {
        description:
          "Exact literal text to replace. Include 3+ lines of context for unique matching. Match whitespace/indentation precisely.",
        type: String,
      },
      newString: {
        description:
          "Exact replacement text. Ensure proper formatting and valid syntax.",
        type: String,
      },
      expected_replacements: {
        description:
          "Number of replacements expected (default: 1). Use for bulk replacements.",
        type: Number,
        minimum: 1,
      },
    },
    required: ["filePath", "oldString", "newString"],
    type: Object,
  },

  {
    name: "read_file",
    description:
      "Reads file content from local filesystem. Supports text files, images (PNG, JPG, GIF, WEBP, SVG, BMP), and PDFs. Can read specific line ranges for text files.",
    toolOptions: {
      absolutePath: {
        description:
          "Absolute path to file (e.g., /home/user/project/file.txt). Relative paths not supported.",
        type: String,
      },
      startLine: {
        description:
          "Optional: 0-based line number to start reading from. Requires endLine. Use for large files.",
        type: Number,
      },
      endLine: {
        description:
          "Optional: Line number to read until. Use with startLine for pagination.",
        type: Number,
      },
    },
    required: ["absolutePath"],
    type: Object,
  },

  {
    name: "shell_command",
    description: `Executes shell command as 'bash -c <command>'. Can start background processes with '&'. Returns command output, error, exit code, signal, and process info.

Process management:
- Command runs in its own process group
- Terminate: kill -- -PGID
- Signal: kill -s SIGNAL -- -PGID`,
    toolOptions: {
      command: {
        description: "Exact bash command to execute",
        type: String,
      },
      description: {
        description:
          "Brief description for user (1-3 sentences, no line breaks)",
        type: String,
      },
      directory: {
        description:
          "Optional: Directory to run command in (relative to project root, must exist)",
        type: String,
      },
    },
    required: ["command"],
    type: Object,
  },

  {
    name: "glob",
    description:
      "Finds files matching glob patterns (e.g., src/**/*.ts, **/*.md). Returns absolute paths sorted by modification time (newest first).",
    toolOptions: {
      pattern: {
        description: "Glob pattern to match (e.g., '**/*.py', 'docs/*.md')",
        type: String,
      },
    },
    required: ["pattern"],
    type: Object,
  },

  {
    name: "grep",
    description:
      "Searches for regex pattern in file contents within a directory. Can filter files by glob pattern. Returns matching lines with file paths and line numbers.",
    toolOptions: {
      pattern: {
        description:
          "Regex pattern to search for (e.g., 'function\\s+myFunction', 'import\\s+\\{.*\\}')",
        type: String,
      },
      path: {
        description:
          "Optional: Absolute path to directory to search. Defaults to current directory.",
        type: String,
      },
      include: {
        description:
          "Optional: Glob pattern to filter files (e.g., '*.js', '*.{ts,tsx}', 'src/**')",
        type: String,
      },
    },
    required: ["pattern"],
    type: Object,
  },

  {
    name: "new_file",
    description:
      "Creates a new file at the specified absolute path with given content. Creates parent directories if needed. Overwrites existing files without warning.",
    toolOptions: {
      filePath: {
        description:
          "Absolute path with filename (e.g., /src/components/Button.tsx)",
        type: String,
      },
      content: {
        description: "File content. Ensure proper formatting and syntax.",
        type: String,
      },
    },
    required: ["filePath", "content"],
    type: Object,
  },
];
