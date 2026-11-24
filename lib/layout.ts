import dagre from "@dagrejs/dagre";
import type { PlaybookNode, PlaybookEdge } from "./types";

export const NODE_WIDTH = 320;
export const NODE_HEIGHT = 128;

/**
 * Arranges nodes hierarchically (left-to-right) using @dagrejs/dagre
 * and converts Dagre's center coordinates to React Flow's top-left coordinates.
 */
export function getLayoutedElements(
  nodes: PlaybookNode[],
  edges: PlaybookEdge[],
  direction: "LR" | "TB" = "LR"
): { nodes: PlaybookNode[]; edges: PlaybookEdge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 42,
    ranksep: 130,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes: PlaybookNode[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) {
      return node;
    }
    return {
      ...node,
      position: {
        x: Math.round(nodeWithPosition.x - NODE_WIDTH / 2),
        y: Math.round(nodeWithPosition.y - NODE_HEIGHT / 2),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
