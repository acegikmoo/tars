import * as fs from "fs";
import * as path from "path";

interface getFolderStructureType {
  gitIgnoreChecker: (filePath: string) => boolean | null;
  rootDir: string;
}

interface TreeNode {
  name: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

export function getFolderStructure({
  gitIgnoreChecker,
  rootDir,
}: getFolderStructureType): string {
  if (!gitIgnoreChecker) {
    gitIgnoreChecker = (filePath: string) => {
      return false;
    };
  }
  const tree = buildTree(rootDir, gitIgnoreChecker);
  return formatTree(tree, rootDir);
}

function buildTree(
  dirPath: string,
  gitIgnoreChecker: (filePath: string) => boolean | null,
  basePath?: string,
): TreeNode[] {
  const baseDir = basePath || dirPath;
  const nodes: TreeNode[] = [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (gitIgnoreChecker(relativePath)) {
        continue;
      }

      const node: TreeNode = {
        name: item.name,
        isDirectory: item.isDirectory(),
      };

      if (item.isDirectory()) {
        node.children = buildTree(fullPath, gitIgnoreChecker, baseDir);
      }

      nodes.push(node);
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dirPath}: ${error}`);
  }
  return nodes;
}

function formatTree(
  nodes: TreeNode[],
  rootDir: string,
  prefix: string = "",
  isLast: boolean = true,
): string {
  let result = "";

  if (prefix === "") {
    result += `${path.basename(rootDir)}/\n`;
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const isLastNode = i === nodes.length - 1;
    const currentPrefix = isLastNode ? "└───" : "├───";
    const nextPrefix = prefix + (isLastNode ? "    " : "│   ");

    result += `${prefix}${currentPrefix}${node.name}${node.isDirectory ? "/" : ""}\n`;

    if (node.isDirectory && node.children && node.children.length > 0) {
      result += formatTree(node.children, rootDir, nextPrefix, isLastNode);
    }
  }

  return result;
}
