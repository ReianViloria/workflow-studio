"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  BackgroundVariant,
  MarkerType,
  PanOnScrollMode,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Trash2,
  LayoutGrid,
  Search,
  RotateCcw,
  CheckCircle2,
  Loader2,
  BookOpen,
  Sparkles,
  PanelRightOpen,
  FolderPlus,
  ChevronDown,
  Check,
} from "lucide-react";

import type {
  BoardMeta,
  NodeStatus,
  PlaybookNode,
  PlaybookEdge,
  PlaybookPayload,
} from "@/lib/types";
import { getLayoutedElements } from "@/lib/layout";
import { computeEffectiveSkippedIds } from "@/lib/skip-propagation";
import { PlaybookNodeCard } from "./PlaybookNodeCard";
import { SideDrawer } from "./SideDrawer";

const nodeTypes = {
  playbookNode: PlaybookNodeCard,
  specNode: PlaybookNodeCard,
};

function computeAncestorPath(
  targetId: string | null,
  nodes: PlaybookNode[],
  edges: PlaybookEdge[]
): {
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  orderedBreadcrumb: PlaybookNode[];
} {
  const highlightedNodeIds = new Set<string>();
  const highlightedEdgeIds = new Set<string>();
  const orderedBreadcrumb: PlaybookNode[] = [];

  if (!targetId) {
    return { highlightedNodeIds, highlightedEdgeIds, orderedBreadcrumb };
  }

  const nodeMap = new Map<string, PlaybookNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Build parent map (target -> list of incoming edges)
  const incomingEdgesMap = new Map<string, PlaybookEdge[]>();
  for (const e of edges) {
    if (!incomingEdgesMap.has(e.target)) {
      incomingEdgesMap.set(e.target, []);
    }
    incomingEdgesMap.get(e.target)!.push(e);
  }

  // BFS/DFS backwards from targetId to root
  const visited = new Set<string>();
  const parentChain: string[] = [];
  let cursor: string | undefined = targetId;

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    highlightedNodeIds.add(cursor);
    parentChain.unshift(cursor);

    const incoming: PlaybookEdge[] = incomingEdgesMap.get(cursor) || [];
    if (incoming.length === 0) break;

    for (const edge of incoming) {
      highlightedEdgeIds.add(edge.id);
      highlightedNodeIds.add(edge.source);
    }
    cursor = incoming[0].source;
  }

  for (const id of parentChain) {
    const found = nodeMap.get(id);
    if (found) orderedBreadcrumb.push(found);
  }

  return { highlightedNodeIds, highlightedEdgeIds, orderedBreadcrumb };
}

interface InnerCanvasProps {
  initialData: PlaybookPayload;
  initialBoards: BoardMeta[];
  initialTemplates: string[];
}

function PlaybookCanvasInner({
  initialData,
  initialBoards,
  initialTemplates,
}: InnerCanvasProps) {
  const [boards, setBoards] = useState<BoardMeta[]>(initialBoards);
  const [templates] = useState<string[]>(initialTemplates);
  const [activeBoard, setActiveBoard] = useState<BoardMeta>(initialData.board);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>("project1");
  const [selectedBlueprint, setSelectedBlueprint] = useState<string>("3d-mto-blueprint");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    initialTemplates[0] || "none"
  );
  const [createError, setCreateError] = useState<string>("");
  const [nodes, setNodes, onNodesChange] = useNodesState<PlaybookNode>(
    initialData.graph.nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<PlaybookEdge>(
    initialData.graph.edges
  );
  const [contents, setContents] = useState<Record<string, string>>(
    initialData.contents
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("root");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [drawerInitialMode, setDrawerInitialMode] = useState<"read" | "edit">(
    "read"
  );
  const [drawerMode, setDrawerMode] = useState<"read" | "edit">("read");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState<boolean>(false);
  const [projectQuery, setProjectQuery] = useState<string>("");
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const contractSummary: Record<string, boolean> = useMemo(() => ({}), []);
  const [syncMessage, setSyncMessage] = useState<string>(
    `Synced with ${initialData.board.compiledFile}`
  );

  const { fitView, setCenter, getViewport, setViewport } = useReactFlow();
  const nodeCounterRef = useRef<number>(1);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const lastPayloadHashRef = useRef<string>(JSON.stringify(initialData));

  const fetchContractSummary = useCallback(async (_boardId: string) => {
    // No external contract widgets in standalone Workflow Studio
  }, []);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(event.target as Node)
      ) {
        setProjectMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjectMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [projectMenuOpen]);

  const filteredBoards = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q)
    );
  }, [boards, projectQuery]);

  // Switch between Freelance Playbook, 3D MTO Blueprint, and Client Project Boards
  const handleSwitchBoard = useCallback(
    async (targetBoardId: string) => {
      setIsSaving(true);
      setSyncMessage(`Loading ${targetBoardId}...`);
      try {
        const res = await fetch(`/api/playbook?board=${encodeURIComponent(targetBoardId)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const latest = (await res.json()) as PlaybookPayload;
        lastPayloadHashRef.current = JSON.stringify(latest);
        setActiveBoard(latest.board);
        setNodes(latest.graph.nodes);
        setEdges(latest.graph.edges);
        setContents(latest.contents);
        setSelectedNodeId("root");
        setDrawerMode("read");
        setDrawerInitialMode("read");
        setSyncMessage(`Loaded ${latest.board.name}`);
        window.history.replaceState(null, "", `/?board=${encodeURIComponent(targetBoardId)}`);
        setTimeout(() => void fitView({ padding: 0.14, duration: 400 }), 40);
      } finally {
        setIsSaving(false);
      }
    },
    [setNodes, setEdges, fitView]
  );

  const handleOpenCreateModal = useCallback(() => {
    setCreateError("");
    setNewProjectName(`project-${boards.length}`);
    setSelectedBlueprint("starter-blueprint");
    setSelectedTemplate("none");
    setNewProjectModalOpen(true);
  }, [boards]);

  const handleSubmitCreateProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProjectName.trim()) {
        setCreateError("Project name is required.");
        return;
      }
      setCreateError("");
      setIsSaving(true);
      try {
        const res = await fetch("/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newProjectName.trim(),
            blueprintId: selectedBlueprint,
            templateName: selectedTemplate,
          }),
        });
        const data = (await res.json()) as {
          board?: BoardMeta;
          createdRepoPath?: string;
          error?: string;
        };
        if (!res.ok || !data.board) {
          setCreateError(data.error || "Failed to create project.");
          return;
        }
        const createdBoard = data.board;
        setBoards((prev) =>
          prev.some((b) => b.id === createdBoard.id) ? prev : [...prev, createdBoard]
        );
        setNewProjectModalOpen(false);
        await handleSwitchBoard(createdBoard.id);
        if (data.createdRepoPath) {
          setSyncMessage(`Cloned ${data.createdRepoPath} & ${createdBoard.id}`);
        }
      } catch {
        setCreateError("Network error while creating project.");
      } finally {
        setIsSaving(false);
      }
    },
    [newProjectName, selectedBlueprint, selectedTemplate, handleSwitchBoard]
  );

  // Silent disk hot-sync helper (used on node focus, window focus, and 2.5s polling)
  const syncFromDiskSilently = useCallback(async () => {
    if (isSaving || isDraggingRef.current || drawerMode === "edit") return;
    try {
      const res = await fetch(`/api/playbook?board=${encodeURIComponent(activeBoard.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const latest = (await res.json()) as PlaybookPayload;
      const nextHash = JSON.stringify(latest);
      if (nextHash !== lastPayloadHashRef.current) {
        lastPayloadHashRef.current = nextHash;
        setActiveBoard(latest.board);
        setNodes(latest.graph.nodes);
        setEdges(latest.graph.edges);
        setContents(latest.contents);
        setSyncMessage("Hot-reloaded changes from disk");
      }
    } catch {
      // Ignore transient network errors during background poll
    }
  }, [isSaving, drawerMode, activeBoard.id, setNodes, setEdges]);

  // Background polling (every 2.5s) + Window focus hot-sync
  useEffect(() => {
    const intervalId = setInterval(() => {
      void syncFromDiskSilently();
    }, 2500);

    const handleWindowFocus = () => {
      void syncFromDiskSilently();
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [syncFromDiskSilently]);

  // High-sensitivity touchpad pinch-to-zoom override for Windows & macOS
  useEffect(() => {
    const container = canvasWrapperRef.current;
    if (!container) return;

    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 1.8;
    const PINCH_SENSITIVITY = 9; // Matches macOS trackpad responsiveness on Windows Precision Touchpads

    const handleWheelCapture = (event: WheelEvent) => {
      // Touchpad pinch gestures emit wheel events with ctrlKey === true
      if (!event.ctrlKey) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      const { x, y, zoom } = getViewport();
      const step =
        event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
      const pinchDelta = -event.deltaY * step * PINCH_SENSITIVITY;
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, zoom * Math.pow(2, pinchDelta))
      );

      // Anchor zoom directly under the cursor position
      const canvasX = (pointerX - x) / zoom;
      const canvasY = (pointerY - y) / zoom;
      const nextX = pointerX - canvasX * nextZoom;
      const nextY = pointerY - canvasY * nextZoom;

      void setViewport({ x: nextX, y: nextY, zoom: nextZoom }, { duration: 0 });
    };

    container.addEventListener("wheel", handleWheelCapture, {
      passive: false,
      capture: true,
    });
    return () => {
      container.removeEventListener("wheel", handleWheelCapture, {
        capture: true,
      });
    };
  }, [getViewport, setViewport]);

  // Strip temporary UI flags before persisting to board graph.json
  const persistGraphToDisk = useCallback(
    async (
      nextNodes: PlaybookNode[],
      nextEdges: PlaybookEdge[],
      label = `Saved & compiled ${activeBoard.compiledFile}`
    ) => {
      setIsSaving(true);
      setSyncMessage("Saving to disk...");
      try {
        const cleanNodes: PlaybookNode[] = nextNodes.map((n) => ({
          id: n.id,
          type: "playbookNode",
          position: {
            x: Math.round(n.position.x),
            y: Math.round(n.position.y),
          },
          data: {
            title: n.data.title,
            slug: n.data.slug || n.id,
            category: n.data.category || "Playbook Node",
            ...(n.data.status ? { status: n.data.status } : {}),
            summary: n.data.summary || "",
          },
        }));

        const cleanEdges: PlaybookEdge[] = nextEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        }));

        await fetch(`/api/graph?board=${encodeURIComponent(activeBoard.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes: cleanNodes, edges: cleanEdges }),
        });

        setSyncMessage(label);
      } catch (err) {
        console.error("Failed to save graph:", err);
        setSyncMessage("Error saving graph");
      } finally {
        setIsSaving(false);
      }
    },
    [activeBoard.id, activeBoard.compiledFile]
  );

  // Ancestor path highlighting from root to selectedNodeId
  const { highlightedNodeIds, highlightedEdgeIds, orderedBreadcrumb } = useMemo(
    () => computeAncestorPath(selectedNodeId, nodes, edges),
    [selectedNodeId, nodes, edges]
  );

  // Compute explicit & cascaded unused (skipped) nodes
  const { explicitSkippedIds, effectiveSkippedIds } = useMemo(
    () => computeEffectiveSkippedIds(nodes, edges),
    [nodes, edges]
  );

  // Decorate nodes with highlight/selection & cascading skip state
  const decoratedNodes = useMemo(() => {
    return nodes.map((node) => {
      const slug = node.data.slug || node.id;
      const hasContractError =
        slug in contractSummary ? contractSummary[slug] === false : false;
      const isInheritedSkipped =
        effectiveSkippedIds.has(node.id) && !explicitSkippedIds.has(node.id);
      return {
        ...node,
        type: "playbookNode" as const,
        selected: node.id === selectedNodeId || node.selected,
        data: {
          ...node.data,
          boardType: activeBoard.type,
          hasContractError,
          isInheritedSkipped,
          isRoot: node.id === "root",
          isSelected: node.id === selectedNodeId,
          isHighlighted: highlightedNodeIds.has(node.id),
        },
      };
    });
  }, [
    nodes,
    selectedNodeId,
    highlightedNodeIds,
    activeBoard.type,
    contractSummary,
    explicitSkippedIds,
    effectiveSkippedIds,
  ]);

  // Decorate edges with animated path highlighting & dimmed skipped paths
  const decoratedEdges = useMemo(() => {
    return edges.map((edge) => {
      const isSkippedEdge =
        effectiveSkippedIds.has(edge.source) || effectiveSkippedIds.has(edge.target);
      const isPathEdge = !isSkippedEdge && highlightedEdgeIds.has(edge.id);
      const isOutgoingFromSelected = !isSkippedEdge && edge.source === selectedNodeId;
      return {
        ...edge,
        type: "smoothstep" as const,
        pathOptions: {
          borderRadius: 24,
          offset: 24,
        },
        animated: isPathEdge || isOutgoingFromSelected,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: isSkippedEdge
            ? "#334155"
            : isPathEdge
            ? "#fbbf24"
            : isOutgoingFromSelected
            ? "#818cf8"
            : "#64748b",
        },
        style: {
          strokeWidth: isSkippedEdge
            ? 1.4
            : isPathEdge
            ? 3
            : isOutgoingFromSelected
            ? 2.2
            : 1.6,
          stroke: isSkippedEdge
            ? "#475569"
            : isPathEdge
            ? "#fbbf24"
            : isOutgoingFromSelected
            ? "#818cf8"
            : "#475569",
          ...(isSkippedEdge ? { strokeDasharray: "6 5", opacity: 0.35 } : {}),
        },
      };
    });
  }, [nodes, edges, highlightedEdgeIds, selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const childNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    const targetIds = new Set(
      edges.filter((e) => e.source === selectedNodeId).map((e) => e.target)
    );
    return nodes.filter((n) => targetIds.has(n.id));
  }, [selectedNodeId, nodes, edges]);

  // Node drag end -> persist updated coordinates
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, _node: PlaybookNode, currentNodes: PlaybookNode[]) => {
      isDraggingRef.current = false;
      // Merge dragged positions into full node list
      const updatedMap = new Map(currentNodes.map((n) => [n.id, n.position]));
      const nextNodes = nodes.map((n) =>
        updatedMap.has(n.id) ? { ...n, position: updatedMap.get(n.id)! } : n
      );
      setNodes(nextNodes);
      void persistGraphToDisk(nextNodes, edges, "Saved coordinates to graph.json");
    },
    [nodes, edges, setNodes, persistGraphToDisk]
  );

  // Connect two nodes with a new edge -> persist immediately
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      const edgeId = `e-${connection.source}-${connection.target}`;
      const nextEdges = addEdge(
        {
          ...connection,
          id: edgeId,
        },
        edges
      );
      setEdges(nextEdges);
      void persistGraphToDisk(nodes, nextEdges, "Connected arrow & updated PLAYBOOK.md");
    },
    [edges, nodes, setEdges, persistGraphToDisk]
  );

  // Add a new node (either branching from parentNode, selectedNode, or root)
  const handleAddNode = useCallback(
    async (parentOverride?: PlaybookNode) => {
      const parentNode =
        parentOverride ||
        nodes.find((n) => n.id === selectedNodeId) ||
        nodes.find((n) => n.id === "root") ||
        nodes[0];

      const suffix = `${Date.now().toString().slice(-4)}-${nodeCounterRef.current++}`;
      const newSlug = `custom-node-${suffix}`;
      const newTitle = `New Playbook Node`;
      const newCategory = parentNode?.data.category || "Custom Playbook Path";
      const newSummary =
        "Document key workflows, checklists, and reusable templates for this step.";

      // Calculate non-overlapping position to the right of parentNode
      const baseX = (parentNode?.position.x ?? 0) + 420;
      const baseY = (parentNode?.position.y ?? 200) + 80;

      const newNode: PlaybookNode = {
        id: newSlug,
        type: "playbookNode",
        position: { x: baseX, y: baseY },
        data: {
          title: newTitle,
          slug: newSlug,
          category: newCategory,
          summary: newSummary,
        },
      };

      const defaultMd = `# ${newTitle}\n\n> ${newSummary}\n\n## Action Checklist\n\n- [ ] Define clear scope and acceptance criteria\n- [ ] Add copy-paste template or runbook snippet below\n\n\`\`\`markdown\n### Reusable Template\nReplace this block with your copy-paste playbook template.\n\`\`\`\n`;

      const nextNodes = [...nodes, newNode];
      const nextEdges = parentNode
        ? [
            ...edges,
            {
              id: `e-${parentNode.id}-${newSlug}`,
              source: parentNode.id,
              target: newSlug,
            },
          ]
        : edges;

      setNodes(nextNodes);
      setEdges(nextEdges);
      setContents((prev) => ({ ...prev, [newSlug]: defaultMd }));
      setSelectedNodeId(newSlug);
      setDrawerInitialMode("edit");
      setDrawerOpen(true);

      await persistGraphToDisk(nextNodes, nextEdges, "Added node & created .md file");
      await fetch(`/api/content/${newSlug}?board=${encodeURIComponent(activeBoard.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: defaultMd,
          title: newTitle,
          category: newCategory,
          ...(activeBoard.type === "project" ? { status: "todo" } : {}),
          summary: newSummary,
        }),
      });
    },
    [nodes, edges, selectedNodeId, activeBoard.id, activeBoard.type, setNodes, setEdges, persistGraphToDisk]
  );

  // Delete a specific node by ID or currently selected nodes/edges
  const handleDeleteNodeById = useCallback(
    async (nodeIdToDelete: string) => {
      if (nodeIdToDelete === "root") {
        setSyncMessage("Root node cannot be deleted");
        return;
      }
      const nextNodes = nodes.filter((n) => n.id !== nodeIdToDelete);
      const nextEdges = edges.filter(
        (e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete
      );

      setNodes(nextNodes);
      setEdges(nextEdges);
      if (selectedNodeId === nodeIdToDelete) {
        setSelectedNodeId("root");
      }

      await persistGraphToDisk(nextNodes, nextEdges, "Deleted node & recompiled PLAYBOOK.md");
    },
    [nodes, edges, selectedNodeId, setNodes, setEdges, persistGraphToDisk]
  );

  const handleDeleteSelected = useCallback(async () => {
    const selectedNodesToRemove = new Set(
      nodes
        .filter((n) => (n.selected || n.id === selectedNodeId) && n.id !== "root")
        .map((n) => n.id)
    );
    const selectedEdgesToRemove = new Set(
      edges.filter((e) => e.selected).map((e) => e.id)
    );

    if (selectedNodesToRemove.size === 0 && selectedEdgesToRemove.size === 0) {
      setSyncMessage("Select a non-root node or arrow to delete");
      return;
    }

    const nextNodes = nodes.filter((n) => !selectedNodesToRemove.has(n.id));
    const nextEdges = edges.filter(
      (e) =>
        !selectedEdgesToRemove.has(e.id) &&
        !selectedNodesToRemove.has(e.source) &&
        !selectedNodesToRemove.has(e.target)
    );

    setNodes(nextNodes);
    setEdges(nextEdges);
    if (selectedNodeId && selectedNodesToRemove.has(selectedNodeId)) {
      setSelectedNodeId("root");
    }

    await persistGraphToDisk(
      nextNodes,
      nextEdges,
      "Deleted selection & updated PLAYBOOK.md"
    );
  }, [nodes, edges, selectedNodeId, setNodes, setEdges, persistGraphToDisk]);

  // Auto-Layout using @dagrejs/dagre (left-to-right)
  const handleAutoLayout = useCallback(async () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "LR"
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    setTimeout(() => {
      void fitView({ padding: 0.16, duration: 450 });
    }, 40);

    await persistGraphToDisk(
      layoutedNodes,
      layoutedEdges,
      "Auto-Layout saved to data/graph.json"
    );
  }, [nodes, edges, setNodes, setEdges, fitView, persistGraphToDisk]);

  // Reset View & re-fetch latest disk state (two-way sync from disk to UI)
  const handleResetAndRefreshFromDisk = useCallback(async () => {
    setIsSaving(true);
    setSyncMessage("Syncing from disk...");
    try {
      const res = await fetch(`/api/playbook?board=${encodeURIComponent(activeBoard.id)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const latest = (await res.json()) as PlaybookPayload;
        lastPayloadHashRef.current = JSON.stringify(latest);
        setActiveBoard(latest.board);
        setNodes(latest.graph.nodes);
        setEdges(latest.graph.edges);
        setContents(latest.contents);
        setSyncMessage("Reloaded latest files from disk");
      }
    } catch (err) {
      console.error("Failed to reload from disk:", err);
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        void fitView({ padding: 0.16, duration: 450 });
      }, 40);
    }
  }, [activeBoard.id, setNodes, setEdges, fitView]);

  // Save Markdown and metadata from Side Drawer
  const handleSaveNodeContent = useCallback(
    async (
      slug: string,
      updatedMarkdown: string,
      meta: {
        title: string;
        category: string;
        status?: NodeStatus;
        isPaidAddon?: boolean;
        questions?: string[];
        summary: string;
      }
    ) => {
      setIsSaving(true);
      setSyncMessage(`Saving boards/${activeBoard.id}/content/${slug}.md...`);
      try {
        const res = await fetch(
          `/api/content/${encodeURIComponent(slug)}?board=${encodeURIComponent(activeBoard.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              markdown: updatedMarkdown,
              title: meta.title,
              category: meta.category,
              status: meta.status,
              isPaidAddon: meta.isPaidAddon,
              questions: meta.questions,
              summary: meta.summary,
            }),
          }
        );

        if (res.ok) {
          setContents((prev) => ({ ...prev, [slug]: updatedMarkdown }));
          setNodes((prevNodes) =>
            prevNodes.map((n) =>
              (n.data.slug || n.id) === slug
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      title: meta.title,
                      category: meta.category,
                      ...(meta.status ? { status: meta.status } : {}),
                      ...(meta.isPaidAddon !== undefined ? { isPaidAddon: meta.isPaidAddon } : {}),
                      ...(meta.questions !== undefined ? { questions: meta.questions } : {}),
                      summary: meta.summary,
                    },
                  }
                : n
            )
          );
          setSyncMessage(`Saved ${slug}.md & recompiled ${activeBoard.compiledFile}`);
        }
      } catch (err) {
        console.error("Failed to save markdown:", err);
        setSyncMessage("Error saving markdown");
      } finally {
        setIsSaving(false);
      }
    },
    [activeBoard.id, activeBoard.compiledFile, setNodes]
  );

  // Jump to a specific node and focus it on canvas
  const handleSelectAndFocusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setDrawerInitialMode("read");
      setDrawerMode("read");
      setDrawerOpen(true);
      setSearchFocused(false);
      void syncFromDiskSilently();
      const target = nodes.find((n) => n.id === nodeId);
      if (target) {
        void setCenter(target.position.x + 160, target.position.y + 64, {
          zoom: 1.05,
          duration: 450,
        });
      }
    },
    [nodes, setCenter, syncFromDiskSilently]
  );

  // Search results filtering nodes by title, slug, category, or markdown body
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((node) => {
      const slug = node.data.slug || node.id;
      const md = contents[slug] || "";
      return (
        node.data.title.toLowerCase().includes(q) ||
        slug.toLowerCase().includes(q) ||
        (node.data.category || "").toLowerCase().includes(q) ||
        (node.data.summary || "").toLowerCase().includes(q) ||
        md.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, nodes, contents]);

  const activeSlug = selectedNode
    ? selectedNode.data.slug || selectedNode.id
    : "root";
  const activeMarkdown = contents[activeSlug] || "";

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Toolbar */}
      <header className="h-16 px-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-3 z-40 shrink-0">
        {/* Brand & Board Switcher */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-5 h-5 text-slate-950" />
          </div>
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {/* Searchable Project Switcher Dropdown */}
              <div ref={projectMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Select Project Board"
                  aria-expanded={projectMenuOpen}
                  onClick={() => {
                    setProjectMenuOpen((prev) => !prev);
                    setProjectQuery("");
                  }}
                  className="inline-flex items-center justify-between gap-2 bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-indigo-400/70 rounded-lg px-2.5 py-1 text-xs font-bold text-white transition-colors min-w-[180px] max-w-[240px]"
                >
                  <span className="truncate">{activeBoard.name}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                      projectMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {projectMenuOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-800">
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                        <input
                          type="text"
                          autoFocus
                          value={projectQuery}
                          onChange={(e) => setProjectQuery(e.target.value)}
                          placeholder="Search projects..."
                          className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {filteredBoards.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-slate-400 text-center">
                          No matching projects.
                        </div>
                      ) : (
                        filteredBoards.map((b) => {
                          const isCurrent = b.id === activeBoard.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                setProjectMenuOpen(false);
                                setProjectQuery("");
                                if (!isCurrent) void handleSwitchBoard(b.id);
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                                isCurrent
                                  ? "bg-indigo-500/20 text-white"
                                  : "text-slate-200 hover:bg-slate-800"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{b.name}</div>
                                <div className="text-[10px] font-mono text-slate-400 truncate">
                                  boards/{b.id}
                                </div>
                              </div>
                              {isCurrent && (
                                <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-colors"
                title="Create a new project workflow board"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Project</span>
              </button>

              <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <Sparkles className="w-2.5 h-2.5" />
                {activeBoard.compiledFile}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1 text-indigo-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Core
              </span>
              <span className="inline-flex items-center gap-1 text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Adapter
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> External
              </span>
            </div>
          </div>
        </div>

        {/* Search Input & Quick Jump Dropdown */}
        <div className="relative w-64 md:w-80">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes, specs, architecture..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-950 border border-slate-700/90 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            )}
          </div>

          {(searchFocused || searchQuery.trim().length > 0) && (
            <div className="absolute left-0 right-0 mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl divide-y divide-slate-800/80 z-50">
              {searchResults.length === 0 ? (
                <div className="p-3 text-xs text-slate-400 text-center">
                  No matching playbook nodes found.
                </div>
              ) : (
                searchResults.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onMouseDown={() => handleSelectAndFocusNode(node.id)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800/90 transition-colors flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {node.data.title}
                      </span>
                      <span className="text-[10px] font-mono text-indigo-300 shrink-0">
                        {node.data.slug || node.id}.md
                      </span>
                    </div>
                    {node.data.summary && (
                      <span className="text-[11px] text-slate-400 line-clamp-1">
                        {node.data.summary}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Action Toolbar Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleAddNode()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow transition-colors"
            title="Add a new playbook node connected to the selected node"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add Node</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDeleteSelected()}
            disabled={!selectedNodeId || selectedNodeId === "root"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Delete selected node or edge"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Delete Selected</span>
          </button>

          <button
            type="button"
            onClick={() => void handleAutoLayout()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 transition-colors"
            title="Arrange nodes hierarchically (left-to-right) using Dagre without overlaps"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Auto-Layout</span>
          </button>

          <button
            type="button"
            onClick={() => void handleResetAndRefreshFromDisk()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Sync latest changes from disk and fit view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset View</span>
          </button>

          {!drawerOpen && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
              title="Open Side Drawer"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              <span>Open Drawer</span>
            </button>
          )}

          {/* Disk Persistence Status Pill */}
          <div className="hidden xl:flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="truncate max-w-[190px]">{syncMessage}</span>
          </div>
        </div>
      </header>

      {/* Main Split Workspace: Interactive Canvas + Collapsible Side Drawer */}
      <div className="flex-1 flex min-h-0 relative">
        <div ref={canvasWrapperRef} className="flex-1 h-full relative">
          <ReactFlow
            nodes={decoratedNodes}
            edges={decoratedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeDragStart={() => {
              isDraggingRef.current = true;
            }}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={(_event, node) => {
              setSelectedNodeId(node.id);
              setDrawerOpen(true);
              void syncFromDiskSilently();
            }}
            onEdgesDelete={(deletedEdges: Edge[]) => {
              const removedIds = new Set(deletedEdges.map((e) => e.id));
              const nextEdges = edges.filter((e) => !removedIds.has(e.id));
              void persistGraphToDisk(
                nodes,
                nextEdges,
                "Deleted arrow & updated PLAYBOOK.md"
              );
            }}
            nodeTypes={nodeTypes}
            panOnScroll={true}
            panOnScrollMode={PanOnScrollMode.Free}
            panOnScrollSpeed={1.3}
            zoomOnScroll={false}
            zoomOnPinch={true}
            panOnDrag={true}
            fitView
            fitViewOptions={{ padding: 0.14 }}
            minZoom={0.2}
            maxZoom={1.8}
            defaultEdgeOptions={{
              type: "smoothstep",
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.3}
              color="#334155"
            />
            <Controls
              position="bottom-left"
              className="!bg-slate-900/95 !border-slate-700 !rounded-xl !shadow-xl [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!text-slate-200 hover:[&>button]:!bg-slate-800"
            />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(n) => {
                if (n.id === "root") return "#f59e0b";
                if (n.id === selectedNodeId) return "#38bdf8";
                if (highlightedNodeIds.has(n.id)) return "#818cf8";
                return "#334155";
              }}
              maskColor="rgba(2, 6, 23, 0.75)"
              className="!bg-slate-900/95 !border !border-slate-800 !rounded-xl !shadow-2xl"
            />
          </ReactFlow>

          {/* Standard Attribution Footer */}
          <div className="pointer-events-none select-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800/90 text-[11px] text-slate-400 shadow-lg">
            <span>Workflow Studio</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span>© 2026 Reian Brendo B. Viloria</span>
          </div>
        </div>

        {/* Collapsible Right-Hand Side Drawer */}
        {drawerOpen && selectedNode && (
          <SideDrawer
            selectedNode={selectedNode}
            markdown={activeMarkdown}
            boardId={activeBoard.id}
            boardType={activeBoard.type}
            targetRepoPath={activeBoard.targetRepoPath}
            breadcrumbNodes={orderedBreadcrumb}
            childNodes={childNodes}
            initialMode={drawerInitialMode}
            isInheritedSkipped={
              effectiveSkippedIds.has(selectedNode.id) &&
              !explicitSkippedIds.has(selectedNode.id)
            }
            isSaving={isSaving}
            onModeChange={setDrawerMode}
            onContractUpdated={() => void fetchContractSummary(activeBoard.id)}
            onClose={() => setDrawerOpen(false)}
            onSelectNodeId={(id) => handleSelectAndFocusNode(id)}
            onSaveContent={handleSaveNodeContent}
            onAddChildNode={(parent) => void handleAddNode(parent)}
            onDeleteNode={(id) => void handleDeleteNodeById(id)}
          />
        )}
      </div>

      {/* Create New Project Modal */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitCreateProject}
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 flex flex-col gap-4"
          >
            <div>
              <h2 className="text-base font-bold text-white">Create New Project</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Creates a fresh workflow board under <code className="text-indigo-300">boards/</code> and auto-compiles its <code className="text-indigo-300">SPECS.md</code>.
              </p>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Project Name / Folder Slug
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. billing-service or auth-v2"
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-400"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Folder: <code className="text-slate-300">boards/{newProjectName.toLowerCase().replace(/[^a-z0-9-_]+/g, "-") || "project"}/</code>
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Start From Blueprint
              </label>
              <select
                value={selectedBlueprint}
                onChange={(e) => setSelectedBlueprint(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-400"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.id})
                  </option>
                ))}
                <option value="none">Blank Workflow (Empty Root Only)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewProjectModalOpen(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow transition-colors disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function PlaybookCanvas({
  initialData,
  initialBoards,
  initialTemplates,
}: {
  initialData: PlaybookPayload;
  initialBoards: BoardMeta[];
  initialTemplates: string[];
}) {
  return (
    <ReactFlowProvider>
      <PlaybookCanvasInner
        initialData={initialData}
        initialBoards={initialBoards}
        initialTemplates={initialTemplates}
      />
    </ReactFlowProvider>
  );
}
