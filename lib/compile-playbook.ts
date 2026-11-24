import fs from "fs/promises";
import path from "path";
import type { BoardMeta, GraphFile, NodeStatus, PlaybookNode, PlaybookPayload } from "./types";
import { computeEffectiveSkippedIds } from "./skip-propagation";

const BOARDS_DIR = path.join(process.cwd(), "boards");
export const DEFAULT_BOARD_ID = "starter-blueprint";

export async function listTemplates(): Promise<string[]> {
  return [];
}

export function sanitizeSlug(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled-node"
  );
}

function getBoardPaths(boardId: string = DEFAULT_BOARD_ID) {
  const safeBoard = sanitizeSlug(boardId);
  const boardDir = path.join(BOARDS_DIR, safeBoard);
  return {
    safeBoard,
    boardDir,
    metaPath: path.join(boardDir, "board.json"),
    graphPath: path.join(boardDir, "graph.json"),
    contentDir: path.join(boardDir, "content"),
  };
}

export async function listBoards(): Promise<BoardMeta[]> {
  await fs.mkdir(BOARDS_DIR, { recursive: true });
  const entries = await fs.readdir(BOARDS_DIR, { withFileTypes: true });
  const boards: BoardMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(BOARDS_DIR, entry.name, "board.json");
    try {
      const raw = await fs.readFile(metaPath, "utf-8");
      boards.push(JSON.parse(raw) as BoardMeta);
    } catch {
      boards.push({
        id: entry.name,
        name: entry.name,
        type: entry.name === "playbook" ? "playbook" : "project",
        compiledFile: entry.name === "playbook" ? "PLAYBOOK.md" : "SPECS.md",
      });
    }
  }

  // Show Starter Blueprint first, then all projects alphabetically
  return boards.sort((a, b) => {
    if (a.id === DEFAULT_BOARD_ID) return -1;
    if (b.id === DEFAULT_BOARD_ID) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readBoardMeta(boardId: string = DEFAULT_BOARD_ID): Promise<BoardMeta> {
  const { safeBoard, metaPath } = getBoardPaths(boardId);
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(raw) as BoardMeta;
  } catch {
    return {
      id: safeBoard,
      name: safeBoard,
      type: "project",
      compiledFile: "SPECS.md",
    };
  }
}

export async function createProjectBoard(options: {
  name: string;
  blueprintId?: string;
  templateName?: string;
}): Promise<{ board: BoardMeta; createdRepoPath?: string }> {
  const safeId = sanitizeSlug(options.name);
  const blueprintId = options.blueprintId || DEFAULT_BOARD_ID;

  const { boardDir, metaPath, graphPath, contentDir } = getBoardPaths(safeId);

  // Prevent accidentally overwriting an existing board
  try {
    await fs.access(boardDir);
    throw new Error(`Project board "${safeId}" already exists.`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("already exists")) throw err;
  }

  const createdRepoPath: string | undefined = undefined;

  await fs.mkdir(contentDir, { recursive: true });

  if (blueprintId !== "none") {
    const blueprint = getBoardPaths(blueprintId);
    try {
      await fs.copyFile(blueprint.graphPath, graphPath);
      const files = await fs.readdir(blueprint.contentDir);
      for (const f of files) {
        if (f.endsWith(".md")) {
          await fs.copyFile(path.join(blueprint.contentDir, f), path.join(contentDir, f));
        }
      }
    } catch {
      const emptyGraph: GraphFile = {
        nodes: [
          {
            id: "root",
            type: "playbookNode",
            position: { x: 40, y: 120 },
            data: {
              title: options.name.trim() || safeId,
              slug: "root",
              category: "App Root",
              status: "todo",
              summary: "Project workflow root.",
            },
          },
        ],
        edges: [],
      };
      await fs.writeFile(graphPath, JSON.stringify(emptyGraph, null, 2) + "\n", "utf-8");
      await fs.writeFile(path.join(contentDir, "root.md"), `# ${options.name.trim() || safeId}\n\nProject workflow root.\n`, "utf-8");
    }
  } else {
    const emptyGraph: GraphFile = {
      nodes: [
        {
          id: "root",
          type: "playbookNode",
          position: { x: 40, y: 120 },
          data: {
            title: options.name.trim() || safeId,
            slug: "root",
            category: "App Root",
            status: "todo",
            summary: "Project workflow root.",
          },
        },
      ],
      edges: [],
    };
    await fs.writeFile(graphPath, JSON.stringify(emptyGraph, null, 2) + "\n", "utf-8");
    await fs.writeFile(path.join(contentDir, "root.md"), `# ${options.name.trim() || safeId}\n\nProject workflow root.\n`, "utf-8");
  }

  const meta: BoardMeta = {
    id: safeId,
    name: options.name.trim() || safeId,
    type: "project",
    compiledFile: "SPECS.md",
    description: `Project workflow board (${blueprintId}).`,
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  await compilePlaybook(safeId);
  return { board: meta, createdRepoPath };
}

export async function readPlaybookData(boardId: string = DEFAULT_BOARD_ID): Promise<PlaybookPayload> {
  const { safeBoard, graphPath, contentDir } = getBoardPaths(boardId);
  await fs.mkdir(contentDir, { recursive: true });

  const board = await readBoardMeta(safeBoard);
  const graphRaw = await fs.readFile(graphPath, "utf-8");
  const graph: GraphFile = JSON.parse(graphRaw);

  const contents: Record<string, string> = {};
  const files = await fs.readdir(contentDir);

  await Promise.all(
    files
      .filter((f) => f.endsWith(".md"))
      .map(async (file) => {
        const slug = file.replace(/\.md$/, "");
        contents[slug] = await fs.readFile(path.join(contentDir, file), "utf-8");
      })
  );

  for (const node of graph.nodes) {
    const slug = node.data?.slug || node.id;
    if (!(slug in contents)) {
      const defaultMd = `# ${node.data?.title || slug}\n\n${node.data?.summary || "Add documentation here."}\n`;
      contents[slug] = defaultMd;
      await fs.writeFile(path.join(contentDir, `${slug}.md`), defaultMd, "utf-8");
    }
  }

  return { board, graph, contents };
}

export async function saveGraphData(nextGraph: GraphFile, boardId: string = DEFAULT_BOARD_ID): Promise<void> {
  const { safeBoard, graphPath, contentDir } = getBoardPaths(boardId);
  await fs.mkdir(contentDir, { recursive: true });

  let prevSlugs = new Set<string>();
  try {
    const prevRaw = await fs.readFile(graphPath, "utf-8");
    const prevGraph: GraphFile = JSON.parse(prevRaw);
    prevSlugs = new Set(prevGraph.nodes.map((n) => n.data?.slug || n.id));
  } catch {
    // ignore
  }

  const nextSlugs = new Set(nextGraph.nodes.map((n) => n.data?.slug || n.id));

  for (const node of nextGraph.nodes) {
    const slug = sanitizeSlug(node.data?.slug || node.id);
    const mdPath = path.join(contentDir, `${slug}.md`);
    try {
      await fs.access(mdPath);
    } catch {
      const initialMd = `# ${node.data?.title || slug}\n\n${
        node.data?.summary ? `> ${node.data.summary}\n\n` : ""
      }## Overview\n\nDocument workflows, edge cases, and checklists for **${node.data?.title || slug}**.\n`;
      await fs.writeFile(mdPath, initialMd, "utf-8");
    }
  }

  for (const oldSlug of prevSlugs) {
    if (!nextSlugs.has(oldSlug) && oldSlug !== "root") {
      try {
        await fs.unlink(path.join(contentDir, `${sanitizeSlug(oldSlug)}.md`));
      } catch {
        // ignore
      }
    }
  }

  await fs.writeFile(graphPath, JSON.stringify(nextGraph, null, 2) + "\n", "utf-8");
  await compilePlaybook(safeBoard);
}

export async function saveNodeContent(
  slug: string,
  markdown: string,
  meta?: {
    title?: string;
    category?: string;
    status?: NodeStatus;
    isPaidAddon?: boolean;
    summary?: string;
  },
  boardId: string = DEFAULT_BOARD_ID
): Promise<void> {
  const { safeBoard, graphPath, contentDir } = getBoardPaths(boardId);
  const safeSlug = sanitizeSlug(slug);
  await fs.mkdir(contentDir, { recursive: true });
  await fs.writeFile(
    path.join(contentDir, `${safeSlug}.md`),
    markdown.endsWith("\n") ? markdown : markdown + "\n",
    "utf-8"
  );

  if (
    meta &&
    (meta.title !== undefined ||
      meta.category !== undefined ||
      meta.status !== undefined ||
      meta.isPaidAddon !== undefined ||
      meta.summary !== undefined)
  ) {
    const graphRaw = await fs.readFile(graphPath, "utf-8");
    const graph: GraphFile = JSON.parse(graphRaw);
    let updated = false;

    graph.nodes = graph.nodes.map((node) => {
      const nodeSlug = node.data?.slug || node.id;
      if (nodeSlug === safeSlug || node.id === safeSlug) {
        updated = true;
        return {
          ...node,
          data: {
            ...node.data,
            ...(meta.title !== undefined ? { title: meta.title } : {}),
            ...(meta.category !== undefined ? { category: meta.category } : {}),
            ...(meta.status !== undefined ? { status: meta.status } : {}),
            ...(meta.isPaidAddon !== undefined ? { isPaidAddon: meta.isPaidAddon } : {}),
            ...(meta.summary !== undefined ? { summary: meta.summary } : {}),
          },
        };
      }
      return node;
    });

    if (updated) {
      await fs.writeFile(graphPath, JSON.stringify(graph, null, 2) + "\n", "utf-8");
    }
  }

  await compilePlaybook(safeBoard);
}

export async function compilePlaybook(boardId: string = DEFAULT_BOARD_ID): Promise<string> {
  const { boardDir } = getBoardPaths(boardId);
  const { board, graph, contents } = await readPlaybookData(boardId);
  const outPath = path.join(boardDir, board.compiledFile || "PLAYBOOK.md");

  const nodeMap = new Map<string, PlaybookNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  const childrenMap = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
    childrenMap.get(edge.source)!.push(edge.target);
  }

  for (const [, targets] of childrenMap) {
    targets.sort((a, b) => (nodeMap.get(a)?.position.y ?? 0) - (nodeMap.get(b)?.position.y ?? 0));
  }

  const incomingCount = new Map<string, number>();
  for (const node of graph.nodes) incomingCount.set(node.id, 0);
  for (const edge of graph.edges) incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);

  const rootId = nodeMap.has("root")
    ? "root"
    : graph.nodes.find((n) => (incomingCount.get(n.id) ?? 0) === 0)?.id ?? graph.nodes[0]?.id;

  const visited = new Set<string>();
  const traversalOrder: Array<{ node: PlaybookNode; depth: number; pathTitles: string[] }> = [];

  function dfs(nodeId: string, depth: number, pathTitles: string[]) {
    if (visited.has(nodeId)) return;
    const node = nodeMap.get(nodeId);
    if (!node) return;

    visited.add(nodeId);
    const currentPath = [...pathTitles, node.data.title];
    traversalOrder.push({ node, depth, pathTitles: currentPath });

    for (const childId of childrenMap.get(nodeId) ?? []) {
      dfs(childId, depth + 1, currentPath);
    }
  }

  if (rootId) dfs(rootId, 0, []);

  const remainingNodes = graph.nodes
    .filter((n) => !visited.has(n.id))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

  for (const orphan of remainingNodes) {
    dfs(orphan.id, 0, [board.type === "project" ? "External Systems" : "Unlinked Nodes"]);
  }

  const lines: string[] = [];
  lines.push(`<!-- AUTO-GENERATED FILE: DO NOT EDIT ${board.compiledFile} DIRECTLY. -->`);
  lines.push(`<!-- Edit boards/${board.id}/graph.json and content/*.md (or use http://localhost:3333) -->`);
  lines.push("");
  lines.push(`# ${board.name} (Compiled Single-File Agent Context)`);
  lines.push("");
  lines.push("## Workflow Graph Hierarchy");
  lines.push("");

  const { effectiveSkippedIds } = computeEffectiveSkippedIds(graph.nodes, graph.edges);

  for (const { node, depth } of traversalOrder) {
    const indent = "  ".repeat(depth);
    const slug = node.data.slug || node.id;
    const isEffectivelySkipped = effectiveSkippedIds.has(node.id);
    const statusTag = isEffectivelySkipped
      ? " `[SKIPPED — DO NOT IMPLEMENT]`"
      : node.data.status
      ? ` \`[${node.data.status.toUpperCase()}]\``
      : "";
    const addonTag = node.data.isPaidAddon ? " `[PAID ADD-ON]`" : "";
    const summaryText = node.data.summary ? ` — *${node.data.summary}*` : "";
    lines.push(`${indent}- **[${node.data.title}](#node-${slug})**${statusTag}${addonTag} (\`content/${slug}.md\`)${summaryText}`);
  }

  lines.push("", "---", "");

  for (const { node, pathTitles } of traversalOrder) {
    const slug = node.data.slug || node.id;
    const rawMd = (contents[slug] || `# ${node.data.title}`).trim();
    const outgoing = (childrenMap.get(node.id) ?? [])
      .map((targetId) => nodeMap.get(targetId)?.data.title || targetId)
      .join(" → ");
    const isEffectivelySkipped = effectiveSkippedIds.has(node.id);
    const statusInfo = isEffectivelySkipped
      ? " | **Status:** `SKIPPED — DO NOT IMPLEMENT`"
      : node.data.status
      ? ` | **Status:** \`${node.data.status.toUpperCase()}\``
      : "";
    const addonInfo = node.data.isPaidAddon ? " | **Scope:** `PAID ADD-ON`" : "";

    lines.push(`<a id="node-${slug}"></a>`, "");
    lines.push(`<!-- NODE_META: id="${node.id}" slug="${slug}" path="${pathTitles.join(" > ")}" -->`);
    lines.push(`> **Graph Path:** ${pathTitles.join(" → ")}  `);
    lines.push(`> **Source File:** \`admin/boards/${board.id}/content/${slug}.md\`${statusInfo}${addonInfo}${outgoing ? ` | **Branches To:** ${outgoing}` : ""}`);
    lines.push("", rawMd, "", "---", "");
  }

  const compiledOutput = lines.join("\n");
  await fs.writeFile(outPath, compiledOutput, "utf-8");
  return compiledOutput;
}
