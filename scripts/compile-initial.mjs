import fs from "fs/promises";
import path from "path";
import dagre from "@dagrejs/dagre";

const BOARDS_DIR = path.join(process.cwd(), "boards");
const NODE_WIDTH = 320;
const NODE_HEIGHT = 128;

async function compileBoard(boardDir) {
  const metaPath = path.join(boardDir, "board.json");
  const graphPath = path.join(boardDir, "graph.json");
  const contentDir = path.join(boardDir, "content");

  const board = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  const graph = JSON.parse(await fs.readFile(graphPath, "utf-8"));
  const outPath = path.join(boardDir, board.compiledFile || "PLAYBOOK.md");

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 42, ranksep: 130, marginx: 40, marginy: 40 });

  for (const node of graph.nodes) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of graph.edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  graph.nodes = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: {
        x: Math.round(pos.x - NODE_WIDTH / 2),
        y: Math.round(pos.y - NODE_HEIGHT / 2),
      },
    };
  });

  await fs.writeFile(graphPath, JSON.stringify(graph, null, 2) + "\n", "utf-8");

  const files = await fs.readdir(contentDir);
  const contents = {};
  for (const file of files) {
    if (file.endsWith(".md")) {
      contents[file.replace(/\.md$/, "")] = await fs.readFile(path.join(contentDir, file), "utf-8");
    }
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const childrenMap = new Map();
  for (const edge of graph.edges) {
    if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
    childrenMap.get(edge.source).push(edge.target);
  }
  for (const [, targets] of childrenMap) {
    targets.sort((a, b) => (nodeMap.get(a)?.position.y ?? 0) - (nodeMap.get(b)?.position.y ?? 0));
  }

  const visited = new Set();
  const order = [];
  function dfs(id, depth, pathTitles) {
    if (visited.has(id)) return;
    const node = nodeMap.get(id);
    if (!node) return;
    visited.add(id);
    const nextPath = [...pathTitles, node.data.title];
    order.push({ node, depth, pathTitles: nextPath });
    for (const c of childrenMap.get(id) ?? []) dfs(c, depth + 1, nextPath);
  }
  dfs("root", 0, []);

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, 0, [board.type === "project" ? "External Systems" : "Unlinked Nodes"]);
    }
  }

  const lines = [
    `<!-- AUTO-GENERATED FILE: DO NOT EDIT ${board.compiledFile} DIRECTLY. -->`,
    `<!-- Edit boards/${board.id}/graph.json and content/*.md (or use http://localhost:3333) -->`,
    "",
    `# ${board.name} (Compiled Single-File Agent Context)`,
    "",
    "## Workflow Graph Hierarchy",
    "",
  ];
  const explicitSkippedIds = new Set(
    graph.nodes.filter((n) => n.data?.status === "skipped").map((n) => n.id)
  );
  const incomingMap = new Map();
  for (const edge of graph.edges) {
    if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
    incomingMap.get(edge.target).push(edge.source);
  }
  const effectiveSkippedIds = new Set(explicitSkippedIds);
  let skipChanged = true;
  while (skipChanged) {
    skipChanged = false;
    for (const node of graph.nodes) {
      if (effectiveSkippedIds.has(node.id)) continue;
      const parents = incomingMap.get(node.id) ?? [];
      if (parents.length > 0 && parents.every((p) => effectiveSkippedIds.has(p))) {
        effectiveSkippedIds.add(node.id);
        skipChanged = true;
      }
    }
  }

  for (const { node, depth } of order) {
    const slug = node.data.slug || node.id;
    const isEffectivelySkipped = effectiveSkippedIds.has(node.id);
    const statusTag = isEffectivelySkipped
      ? " `[SKIPPED — DO NOT IMPLEMENT]`"
      : node.data.status
      ? ` \`[${node.data.status.toUpperCase()}]\``
      : "";
    const addonTag = node.data.isPaidAddon ? " `[PAID ADD-ON]`" : "";
    lines.push(`${"  ".repeat(depth)}- **[${node.data.title}](#node-${slug})**${statusTag}${addonTag} (\`content/${slug}.md\`) — *${node.data.summary || ""}*`);
  }
  lines.push("", "---", "");
  for (const { node, pathTitles } of order) {
    const slug = node.data.slug || node.id;
    const rawMd = (contents[slug] || `# ${node.data.title}`).trim();
    const outgoing = (childrenMap.get(node.id) ?? []).map((id) => nodeMap.get(id)?.data.title || id).join(" → ");
    const isEffectivelySkipped = effectiveSkippedIds.has(node.id);
    const statusInfo = isEffectivelySkipped
      ? " | **Status:** `SKIPPED — DO NOT IMPLEMENT`"
      : node.data.status
      ? ` | **Status:** \`${node.data.status.toUpperCase()}\``
      : "";
    const addonInfo = node.data.isPaidAddon ? " | **Scope:** `PAID ADD-ON`" : "";
    lines.push(`<a id="node-${slug}"></a>`, "");
    lines.push(`> **Graph Path:** ${pathTitles.join(" → ")}  `);
    lines.push(`> **Source File:** \`admin/boards/${board.id}/content/${slug}.md\`${statusInfo}${addonInfo}${outgoing ? ` | **Branches To:** ${outgoing}` : ""}`);
    lines.push("", rawMd, "", "---", "");
  }

  await fs.writeFile(outPath, lines.join("\n"), "utf-8");
  console.log(`Compiled ${board.id}/${board.compiledFile} (${order.length} nodes).`);
}

async function main() {
  const entries = await fs.readdir(BOARDS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await compileBoard(path.join(BOARDS_DIR, entry.name));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
