import type { Node, Edge } from "@xyflow/react";

export type NodeStatus = "todo" | "in-progress" | "tested" | "skipped";

export interface BoardMeta {
  id: string;
  name: string;
  type: "playbook" | "project";
  compiledFile: string;
  description?: string;
  targetRepoPath?: string;
  templateName?: string;
}

export interface PlaybookNodeData extends Record<string, unknown> {
  title: string;
  slug: string;
  category?: string;
  status?: NodeStatus;
  isPaidAddon?: boolean;
  isInheritedSkipped?: boolean;
  questions?: string[];
  summary?: string;
  boardType?: "playbook" | "project";
  hasContractError?: boolean;
  isRoot?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

export type PlaybookNode = Node<PlaybookNodeData, "playbookNode">;
export type PlaybookEdge = Edge;

export interface GraphFile {
  nodes: PlaybookNode[];
  edges: PlaybookEdge[];
}

export interface PlaybookPayload {
  board: BoardMeta;
  graph: GraphFile;
  contents: Record<string, string>;
}
