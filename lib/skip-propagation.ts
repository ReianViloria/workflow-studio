import type { PlaybookEdge, PlaybookNode } from "./types";

/**
 * Computes explicitly skipped nodes and cascades skip to downstream nodes
 * whose incoming parents are ALL effectively skipped.
 *
 * Exception: if a downstream node has 2+ incoming parents and at least one
 * parent is NOT skipped, that downstream node stays active.
 */
export function computeEffectiveSkippedIds(
  nodes: PlaybookNode[],
  edges: PlaybookEdge[]
): {
  explicitSkippedIds: Set<string>;
  effectiveSkippedIds: Set<string>;
} {
  const explicitSkippedIds = new Set<string>(
    nodes.filter((n) => n.data?.status === "skipped").map((n) => n.id)
  );

  const incomingMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
    incomingMap.get(edge.target)!.push(edge.source);
  }

  const effectiveSkippedIds = new Set<string>(explicitSkippedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (effectiveSkippedIds.has(node.id)) continue;
      const parents = incomingMap.get(node.id) ?? [];
      if (parents.length > 0 && parents.every((parentId) => effectiveSkippedIds.has(parentId))) {
        effectiveSkippedIds.add(node.id);
        changed = true;
      }
    }
  }

  return { explicitSkippedIds, effectiveSkippedIds };
}
