"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  Eye,
  Edit3,
  Save,
  Copy,
  Check,
  FileCode2,
  ChevronRight,
  Trash2,
  PlusCircle,
  CheckCircle2,
  HelpCircle,
  Plus,
  Pencil,
} from "lucide-react";
import type { PlaybookNode, NodeStatus } from "@/lib/types";
import { SmartMarkdownEditor } from "./SmartMarkdownEditor";

interface SideDrawerProps {
  selectedNode: PlaybookNode | null;
  markdown: string;
  boardId: string;
  boardType: "playbook" | "project";
  targetRepoPath?: string;
  breadcrumbNodes: PlaybookNode[];
  childNodes: PlaybookNode[];
  initialMode?: "read" | "edit";
  isInheritedSkipped?: boolean;
  isSaving: boolean;
  onModeChange?: (mode: "read" | "edit") => void;
  onContractUpdated?: () => void;
  onClose: () => void;
  onSelectNodeId: (id: string) => void;
  onSaveContent: (
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
  ) => Promise<void>;
  onAddChildNode: (parentNode: PlaybookNode) => void;
  onDeleteNode: (nodeId: string) => void;
}

function CodeBlockWithCopy({
  inline,
  className,
  children,
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const rawText = String(children ?? "").replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const isBlock = !inline && (Boolean(match) || rawText.includes("\n") || rawText.length > 80);

  if (!isBlock) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 font-mono text-[12px] border border-slate-700/70">
        {children}
      </code>
    );
  }

  const languageLabel = match?.[1] || "template";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950/95 shadow-lg">
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-slate-800">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400">
          <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
          {languageLabel}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-colors"
          title="Copy block to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed">
        <code>{rawText}</code>
      </pre>
    </div>
  );
}

export function SideDrawer({
  selectedNode,
  markdown,
  boardId,
  boardType,
  targetRepoPath,
  breadcrumbNodes,
  childNodes,
  initialMode = "read",
  isInheritedSkipped = false,
  isSaving,
  onModeChange,
  onContractUpdated,
  onClose,
  onSelectNodeId,
  onSaveContent,
  onAddChildNode,
  onDeleteNode,
}: SideDrawerProps) {
  const [mode, setMode] = useState<"read" | "edit">(initialMode);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<NodeStatus>("todo");
  const [isPaidAddon, setIsPaidAddon] = useState(false);
  const [summary, setSummary] = useState("");
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [editorStyle, setEditorStyle] = useState<"rich" | "raw">("rich");
  const [questions, setQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const updateMode = (nextMode: "read" | "edit") => {
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  // Reset mode only when switching to a different node ID
  useEffect(() => {
    if (selectedNode) {
      setMode(initialMode);
      onModeChange?.(initialMode);
      setNewQuestion("");
      setEditingQuestionIdx(null);
      setEditingQuestionText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, initialMode]);

  // Keep fields synced with latest disk updates when in read mode or switching node
  useEffect(() => {
    if (selectedNode && mode === "read") {
      setTitle(selectedNode.data.title || "");
      setCategory(selectedNode.data.category || "Playbook Node");
      setStatus(selectedNode.data.status || "todo");
      setIsPaidAddon(Boolean(selectedNode.data.isPaidAddon));
      setQuestions(Array.isArray(selectedNode.data.questions) ? selectedNode.data.questions : []);
      setSummary(selectedNode.data.summary || "");
      setDraftMarkdown(markdown || "");
    }
  }, [selectedNode, markdown, mode]);

  if (!selectedNode) return null;

  const slug = selectedNode.data.slug || selectedNode.id;
  const isRoot = selectedNode.id === "root";

  const persistQuestions = async (nextQuestions: string[]) => {
    setQuestions(nextQuestions);
    await onSaveContent(slug, markdown || "", {
      title: selectedNode.data.title,
      category: selectedNode.data.category || "Playbook Node",
      ...(boardType === "project"
        ? {
            status: selectedNode.data.status || "todo",
            isPaidAddon: Boolean(selectedNode.data.isPaidAddon),
          }
        : {}),
      questions: nextQuestions,
      summary: selectedNode.data.summary || "",
    });
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newQuestion.trim();
    if (!trimmed || isSaving) return;
    setNewQuestion("");
    await persistQuestions([...questions, trimmed]);
  };

  const handleDeleteQuestion = async (index: number) => {
    if (isSaving) return;
    if (editingQuestionIdx === index) {
      setEditingQuestionIdx(null);
      setEditingQuestionText("");
    }
    await persistQuestions(questions.filter((_, i) => i !== index));
  };

  const handleCommitEditQuestion = async (index: number) => {
    const trimmed = editingQuestionText.trim();
    setEditingQuestionIdx(null);
    setEditingQuestionText("");
    if (!trimmed || trimmed === questions[index] || isSaving) return;
    const next = questions.map((q, i) => (i === index ? trimmed : q));
    await persistQuestions(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveContent(slug, draftMarkdown, {
      title: title.trim() || selectedNode.data.title,
      category: category.trim() || "Playbook Node",
      ...(boardType === "project" ? { status, isPaidAddon } : {}),
      questions,
      summary: summary.trim(),
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
    updateMode("read");
  };

  const handleQuickToggleStatus = async (nextStatus: NodeStatus) => {
    await onSaveContent(slug, markdown || "", {
      title: selectedNode.data.title,
      category: selectedNode.data.category || "Playbook Node",
      status: nextStatus,
      isPaidAddon: Boolean(selectedNode.data.isPaidAddon),
      questions,
      summary: selectedNode.data.summary || "",
    });
  };

  const handleQuickToggleAddon = async () => {
    await onSaveContent(slug, markdown || "", {
      title: selectedNode.data.title,
      category: selectedNode.data.category || "Playbook Node",
      status: selectedNode.data.status || "todo",
      isPaidAddon: !selectedNode.data.isPaidAddon,
      questions,
      summary: selectedNode.data.summary || "",
    });
  };

  return (
    <aside
      aria-label="Playbook Node Side Drawer"
      className="w-[540px] max-w-[92vw] h-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 flex flex-col shadow-2xl z-30"
    >
      {/* Top Drawer Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col gap-3 bg-slate-950/60">
        {/* Path Breadcrumb from Root */}
        {breadcrumbNodes.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 text-[11px] text-slate-400">
            {breadcrumbNodes.map((bNode, idx) => {
              const isLast = idx === breadcrumbNodes.length - 1;
              return (
                <React.Fragment key={bNode.id}>
                  <button
                    type="button"
                    onClick={() => onSelectNodeId(bNode.id)}
                    className={`hover:text-indigo-300 transition-colors truncate max-w-[165px] ${
                      isLast ? "text-amber-300 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {bNode.data.title}
                  </button>
                  {!isLast && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Title & Mode Toggle Bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedNode.data.category || "Playbook Node"}
              </span>
              <span className="text-xs font-mono text-slate-400 truncate">
                boards/{boardId}/content/{slug}.md
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 leading-snug">
              {selectedNode.data.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Row: Read / Edit Switch + Add Sub-Node + Delete */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="inline-flex rounded-lg p-0.5 bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => updateMode("read")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === "read"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Read Mode
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(selectedNode.data.title || "");
                setCategory(selectedNode.data.category || "Playbook Node");
                setStatus(selectedNode.data.status || "todo");
                setIsPaidAddon(Boolean(selectedNode.data.isPaidAddon));
                setSummary(selectedNode.data.summary || "");
                setDraftMarkdown(markdown || "");
                updateMode("edit");
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === "edit"
                  ? "bg-amber-500 text-slate-950 font-semibold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Mode
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {justSaved && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium mr-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => onAddChildNode(selectedNode)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors"
              title="Add a connected child node branching from this node"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Branch Node
            </button>
            {!isRoot && (
              <button
                type="button"
                onClick={() => onDeleteNode(selectedNode.id)}
                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-colors"
                title="Delete this node and its markdown file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Scope Controls (Project Boards) */}
        {boardType === "project" && !isRoot && mode === "read" && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/70">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleQuickToggleAddon()}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                selectedNode.data.isPaidAddon
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30"
                  : "bg-slate-900 text-slate-400 border-slate-700/80 hover:text-slate-200 hover:border-slate-600"
              }`}
              title="Mark whether this node is optional / conditional"
            >
              <span>{selectedNode.data.isPaidAddon ? "Optional (On)" : "Mark as Optional"}</span>
            </button>

            {isInheritedSkipped ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-slate-900/80 text-slate-400 border-slate-700/70 cursor-not-allowed"
                title="Cannot be used while its ancestor node is marked unused — restore the ancestor first"
              >
                Unused (Ancestor Skipped)
              </span>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  void handleQuickToggleStatus(
                    selectedNode.data.status === "skipped" ? "todo" : "skipped"
                  )
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                  selectedNode.data.status === "skipped"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-400/50 hover:bg-indigo-500/30"
                    : "bg-slate-900 text-slate-400 border-slate-700/80 hover:text-rose-300 hover:border-rose-500/40"
                }`}
                title="Grey out & strike through unused branches on this client board"
              >
                <span>
                  {selectedNode.data.status === "skipped"
                    ? "Restore Path (Unskip)"
                    : "Mark Unused (Skip)"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drawer Body: Read Mode vs Edit Mode */}
      {mode === "read" ? (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {selectedNode.data.summary && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-indigo-300">Summary: </span>
              {selectedNode.data.summary}
            </div>
          )}

          {/* Connected Child Branches Quick Jump */}
          {childNodes.length > 0 && (
            <div className="p-3.5 rounded-xl bg-indigo-950/25 border border-indigo-500/25">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 mb-2">
                Connected Downstream Nodes ({childNodes.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {childNodes.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onSelectNodeId(child.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-slate-900/90 hover:bg-indigo-600/30 text-slate-200 hover:text-white border border-slate-700/80 hover:border-indigo-400/50 transition-colors"
                  >
                    <span>{child.data.title}</span>
                    <ChevronRight className="w-3 h-3 text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dedicated Questions Section */}
          <section
            aria-label="Node Questions"
            className="p-3.5 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Questions ({questions.length})</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Saved to node &amp; {boardType === "playbook" ? "PLAYBOOK.md" : "SPECS.md"}
              </span>
            </div>

            {questions.length > 0 ? (
              <ul className="space-y-1.5">
                {questions.map((q, idx) => (
                  <li
                    key={`${idx}-${q.slice(0, 16)}`}
                    className="group/q flex items-start gap-2 px-2.5 py-2 rounded-lg bg-slate-950/75 border border-slate-800/90 text-xs text-slate-200"
                  >
                    <span className="text-[10px] font-mono text-sky-400 mt-0.5 shrink-0">
                      {idx + 1}.
                    </span>
                    {editingQuestionIdx === idx ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingQuestionText}
                          onChange={(e) => setEditingQuestionText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleCommitEditQuestion(idx);
                            } else if (e.key === "Escape") {
                              setEditingQuestionIdx(null);
                              setEditingQuestionText("");
                            }
                          }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded bg-slate-900 border border-sky-400/60 text-xs text-slate-100 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void handleCommitEditQuestion(idx)}
                          className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"
                          title="Save question"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestionIdx(null);
                            setEditingQuestionText("");
                          }}
                          className="p-1 rounded text-slate-400 hover:bg-slate-800"
                          title="Cancel edit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 leading-relaxed break-words">{q}</span>
                        <div className="flex items-center gap-1 opacity-70 group-hover/q:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setEditingQuestionIdx(idx);
                              setEditingQuestionText(q);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 disabled:opacity-40"
                            title="Edit question"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleDeleteQuestion(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 disabled:opacity-40"
                            title="Delete question"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                No questions yet. Add open questions or clarifications for this node below.
              </p>
            )}

            <form onSubmit={handleAddQuestion} className="flex items-center gap-2 pt-0.5">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Add a question for this node..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={isSaving || !newQuestion.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </section>

          {/* Markdown Renderer with GFM Tables, Checklists & Code Copy Buttons */}
          <article className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold text-white mt-2 mb-3 pb-2 border-b border-slate-800">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold text-indigo-300 mt-6 mb-2.5">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-amber-300 mt-4 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-slate-300 leading-relaxed my-2.5">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside pl-5 my-2.5 space-y-1.5 text-sm text-slate-300">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside pl-5 my-2.5 space-y-1.5 text-sm text-slate-300">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed text-slate-300">{children}</li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="pl-3.5 py-1 my-3 border-l-2 border-indigo-400 bg-indigo-950/20 rounded-r-lg text-slate-300 italic">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="my-4 overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-slate-950/90 text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-800">
                    {children}
                  </thead>
                ),
                th: ({ children }) => (
                  <th className="px-3.5 py-2.5 font-semibold text-indigo-300">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3.5 py-2.5 border-t border-slate-800/80 text-slate-300 align-top">
                    {children}
                  </td>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className && !String(children).includes("\n");
                  return (
                    <CodeBlockWithCopy
                      inline={isInline}
                      className={className}
                      {...props}
                    >
                      {children}
                    </CodeBlockWithCopy>
                  );
                },
                pre: ({ children }) => <>{children}</>,
              }}
            >
              {markdown}
            </ReactMarkdown>
          </article>
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden p-5 gap-3.5">
          <div className={`grid ${boardType === "project" ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Node Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                placeholder="Node Title"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Category Badge
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                placeholder="e.g. Adapter Layer"
              />
            </div>

            {boardType === "project" && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  TDD Status
                </label>
                <select
                  value={isInheritedSkipped ? "skipped" : status}
                  disabled={isInheritedSkipped}
                  onChange={(e) => setStatus(e.target.value as NodeStatus)}
                  title={
                    isInheritedSkipped
                      ? "Cannot be changed while an ancestor node is marked unused"
                      : undefined
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="todo">Todo</option>
                  <option value="in-progress">In Progress</option>
                  <option value="tested">Tested</option>
                  <option value="skipped">Skipped (Not Used)</option>
                </select>
              </div>
            )}
          </div>

          {boardType === "project" && (
            <label className="inline-flex items-center gap-2 text-xs text-amber-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPaidAddon}
                onChange={(e) => setIsPaidAddon(e.target.checked)}
                className="rounded border-slate-600 bg-slate-950 text-amber-400 focus:ring-amber-400"
              />
              <span className="font-semibold">Optional Node</span>
              <span className="text-slate-400 font-normal">
                (shows Optional badge on canvas for conditional/phase-2 modules)
              </span>
            </label>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Canvas Card Summary (1-line subtitle)
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              placeholder="Short summary shown on the workflow node card..."
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Content (boards/{boardId}/content/{slug}.md)
              </label>
              <div className="inline-flex rounded-md p-0.5 bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditorStyle("rich")}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    editorStyle === "rich"
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Smart Editor
                </button>
                <button
                  type="button"
                  onClick={() => setEditorStyle("raw")}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    editorStyle === "raw"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Raw MD
                </button>
              </div>
            </div>
            {editorStyle === "rich" ? (
              <SmartMarkdownEditor
                value={draftMarkdown}
                onChange={setDraftMarkdown}
              />
            ) : (
              <textarea
                value={draftMarkdown}
                onChange={(e) => setDraftMarkdown(e.target.value)}
                className="flex-1 w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100 leading-relaxed resize-none focus:outline-none focus:border-amber-400"
                placeholder="# Markdown content..."
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Saves to <code className="text-amber-300">boards/{boardId}/content/{slug}.md</code> &amp; recompiles{" "}
              <code className="text-indigo-300">{boardType === "playbook" ? "PLAYBOOK.md" : "SPECS.md"}</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateMode("read")}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save to Disk"}
              </button>
            </div>
          </div>
        </form>
      )}
    </aside>
  );
}
