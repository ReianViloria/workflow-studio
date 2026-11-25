"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  FileText,
  Sparkles,
  FolderGit2,
  Cpu,
  Plug,
  Globe,
  CheckCircle2,
  Clock,
  CircleDashed,
  AlertTriangle,
  Ban,
  BadgeDollarSign,
  HelpCircle,
} from "lucide-react";
import type { PlaybookNode, NodeStatus } from "@/lib/types";

function getStatusBadge(status?: NodeStatus) {
  if (status === "tested") {
    return {
      label: "Tested",
      classes: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
      icon: <CheckCircle2 className="w-2.5 h-2.5" />,
    };
  }
  if (status === "in-progress") {
    return {
      label: "In Progress",
      classes: "bg-amber-500/20 text-amber-300 border-amber-400/40",
      icon: <Clock className="w-2.5 h-2.5" />,
    };
  }
  if (status === "skipped") {
    return {
      label: "Skipped",
      classes: "bg-slate-900/90 text-slate-400 border-slate-600/60 line-through",
      icon: <Ban className="w-2.5 h-2.5" />,
    };
  }
  return {
    label: "Todo",
    classes: "bg-slate-800/80 text-slate-300 border-slate-600/50",
    icon: <CircleDashed className="w-2.5 h-2.5" />,
  };
}

function getCardStyle(category?: string, isRoot?: boolean, isProjectBoard?: boolean) {
  const cat = (category || "").toLowerCase();

  if (isProjectBoard) {
    if (cat.includes("external")) {
      return {
        label: "EXTERNAL / CLIENT",
        icon: <Globe className="w-3 h-3" />,
        badge: "bg-cyan-500/15 text-cyan-300 border-cyan-400/35",
        border: "border-dashed border-cyan-500/60 bg-slate-950/85",
        glow: "shadow-[0_0_20px_-8px_rgba(6,182,212,0.3)]",
      };
    }
    if (cat.includes("adapter")) {
      return {
        label: "CLIENT ADAPTER",
        icon: <Plug className="w-3 h-3" />,
        badge: "bg-amber-500/20 text-amber-300 border-amber-400/40",
        border: "border-amber-400/60 bg-amber-950/20",
        glow: "shadow-[0_0_22px_-6px_rgba(251,191,36,0.3)]",
      };
    }
    return {
      label: "CORE ENGINE",
      icon: <Cpu className="w-3 h-3" />,
      badge: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40",
      border: "border-indigo-500/55 bg-slate-900/95",
      glow: "shadow-[0_0_22px_-6px_rgba(99,102,241,0.3)]",
    };
  }

  if (isRoot) {
    return {
      label: category || "Root Playbook",
      icon: <Sparkles className="w-3 h-3" />,
      badge: "bg-amber-500/20 text-amber-300 border-amber-400/40",
      border: "border-amber-400/70 bg-slate-900/95",
      glow: "shadow-[0_0_28px_-4px_rgba(251,191,36,0.35)]",
    };
  }
  if (cat.includes("path 1") || cat.includes("positioning") || cat.includes("business")) {
    return {
      label: category || "Path 1",
      icon: <FolderGit2 className="w-3 h-3" />,
      badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
      border: "border-emerald-500/50 bg-slate-900/90",
      glow: "shadow-[0_0_20px_-6px_rgba(16,185,129,0.3)]",
    };
  }
  if (cat.includes("path 2") || cat.includes("finding")) {
    return {
      label: category || "Path 2",
      icon: <FolderGit2 className="w-3 h-3" />,
      badge: "bg-sky-500/15 text-sky-300 border-sky-400/30",
      border: "border-sky-500/50 bg-slate-900/90",
      glow: "shadow-[0_0_20px_-6px_rgba(14,165,233,0.3)]",
    };
  }
  if (cat.includes("path 3") || cat.includes("contract") || cat.includes("sow")) {
    return {
      label: category || "Path 3",
      icon: <FolderGit2 className="w-3 h-3" />,
      badge: "bg-violet-500/15 text-violet-300 border-violet-400/30",
      border: "border-violet-500/50 bg-slate-900/90",
      glow: "shadow-[0_0_20px_-6px_rgba(139,92,246,0.3)]",
    };
  }
  if (cat.includes("path 4") || cat.includes("stack")) {
    return {
      label: category || "Path 4",
      icon: <FolderGit2 className="w-3 h-3" />,
      badge: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
      border: "border-cyan-500/50 bg-slate-900/90",
      glow: "shadow-[0_0_20px_-6px_rgba(6,182,212,0.3)]",
    };
  }
  if (cat.includes("path 5") || cat.includes("cloud") || cat.includes("retainer") || cat.includes("legal")) {
    return {
      label: category || "Path 5",
      icon: <FolderGit2 className="w-3 h-3" />,
      badge: "bg-rose-500/15 text-rose-300 border-rose-400/30",
      border: "border-rose-500/50 bg-slate-900/90",
      glow: "shadow-[0_0_20px_-6px_rgba(244,63,94,0.3)]",
    };
  }
  return {
    label: category || "Playbook Node",
    icon: <FolderGit2 className="w-3 h-3" />,
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
    border: "border-indigo-500/50 bg-slate-900/90",
    glow: "shadow-[0_0_20px_-6px_rgba(99,102,241,0.3)]",
  };
}

function PlaybookNodeCardComponent({ id, data, selected }: NodeProps<PlaybookNode>) {
  const isRoot = id === "root" || Boolean(data.isRoot);
  const isProjectBoard = data.boardType === "project" || Boolean(data.status);
  const hasContractError = Boolean(data.hasContractError);
  const isHighlighted = Boolean(data.isHighlighted);
  const isSelected = Boolean(selected || data.isSelected);
  const isInheritedSkipped = Boolean(data.isInheritedSkipped);
  const isSkipped = data.status === "skipped" || isInheritedSkipped;
  const isPaidAddon = Boolean(data.isPaidAddon);
  const questionCount = Array.isArray(data.questions) ? data.questions.length : 0;
  const accent = getCardStyle(data.category, isRoot, isProjectBoard);
  const statusBadge = isProjectBoard
    ? getStatusBadge(isSkipped ? "skipped" : data.status)
    : null;

  const stepMatch = isProjectBoard ? data.title.match(/^(\d+[a-z]?)\.\s+(.+)$/i) : null;
  const stepNumber = stepMatch ? stepMatch[1].toUpperCase() : null;
  const displayTitle = stepMatch ? stepMatch[2] : data.title;
  const isSpineStep = Boolean(stepNumber);

  return (
    <div
      className={`group relative w-[320px] rounded-xl border-2 backdrop-blur-md transition-all duration-200 select-none ${
        isSkipped
          ? isSelected
            ? "border-dashed border-amber-400/70 bg-slate-950/80 opacity-65 grayscale ring-2 ring-amber-400/25"
            : "border-dashed border-slate-600/70 bg-slate-950/75 opacity-45 grayscale shadow-none hover:opacity-70"
          : hasContractError
          ? "border-rose-500 bg-rose-950/55 ring-2 ring-rose-500/40 shadow-[0_0_28px_-4px_rgba(244,63,94,0.55)]"
          : isSelected
          ? "border-amber-400 bg-slate-900 ring-2 ring-amber-400/40 shadow-[0_0_30px_-4px_rgba(251,191,36,0.45)]"
          : isHighlighted
          ? "border-indigo-400 bg-slate-900 ring-2 ring-indigo-400/30 shadow-[0_0_26px_-4px_rgba(99,102,241,0.45)]"
          : isSpineStep
          ? `border-indigo-400/80 bg-gradient-to-br from-indigo-950/90 via-slate-900/95 to-slate-900/95 hover:border-indigo-300 ${
              questionCount > 0
                ? "ring-2 ring-fuchsia-400/70 shadow-[0_0_28px_-2px_rgba(217,70,239,0.5)]"
                : "shadow-[0_0_30px_-4px_rgba(99,102,241,0.5)]"
            }`
          : `${accent.border} hover:bg-slate-800/90 ${
              questionCount > 0
                ? "ring-2 ring-fuchsia-400/70 shadow-[0_0_28px_-2px_rgba(217,70,239,0.5)]"
                : accent.glow
            }`
      }`}
    >
      {questionCount > 0 && (
        <div
          className="absolute -top-3 right-3 z-10 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide bg-fuchsia-500 text-white border-2 border-slate-950 shadow-[0_0_16px_rgba(217,70,239,0.75)]"
          title={`${questionCount} open ${questionCount === 1 ? "question" : "questions"} for PO`}
        >
          <HelpCircle className="w-3 h-3 stroke-[2.5]" />
          <span>
            {questionCount} {questionCount === 1 ? "Question" : "Questions"}
          </span>
        </div>
      )}

      {isSpineStep && !hasContractError && !isSkipped && (
        <div className="h-1.5 w-full rounded-t-[10px] bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400" />
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-slate-900 group-hover:!bg-indigo-400 transition-colors"
      />

      <div className="p-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${accent.badge}`}
          >
            {accent.icon}
            <span className="truncate max-w-[165px]">{accent.label}</span>
          </span>

          {hasContractError && !isSkipped ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border bg-rose-500/25 text-rose-200 border-rose-400/60">
                <AlertTriangle className="w-2.5 h-2.5" />
                Contract Error
              </span>
            ) : statusBadge ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md border ${statusBadge.classes}`}
              >
                {statusBadge.icon}
                {statusBadge.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-950/70 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[120px]">
                <FileText className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                <span className="truncate">{data.slug || id}.md</span>
              </span>
            )}
        </div>

        <h3
          className={`text-sm font-bold leading-snug flex items-center gap-2 ${
            isSkipped
              ? "text-slate-400 line-through"
              : isSpineStep
              ? "text-white"
              : "text-slate-100"
          }`}
        >
          {stepNumber && (
            <span
              className={`inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md text-[11px] font-extrabold tracking-tight shrink-0 ${
                isSkipped
                  ? "bg-slate-800 text-slate-400"
                  : "bg-indigo-500 text-white shadow-sm shadow-indigo-500/40"
              }`}
            >
              {stepNumber}
            </span>
          )}
          <span className="line-clamp-1">{displayTitle}</span>
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 min-h-[2.25rem]">
          {data.summary || "Click to read or edit Markdown guidelines."}
        </p>

        {isProjectBoard && (
          <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-800/70">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPaidAddon && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-400/50 shrink-0">
                  <Sparkles className="w-2.5 h-2.5" />
                  Optional
                </span>
              )}
              <span className="text-[10px] text-slate-500 truncate">
                {data.category || "Core"}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 shrink-0">
              <FileText className="w-2.5 h-2.5 text-slate-500 shrink-0" />
              <span className="truncate max-w-[115px]">{data.slug || id}.md</span>
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-900 group-hover:!bg-amber-400 transition-colors"
      />
    </div>
  );
}

export const PlaybookNodeCard = memo(PlaybookNodeCardComponent);
