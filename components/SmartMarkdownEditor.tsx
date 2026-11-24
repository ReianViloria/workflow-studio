"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  FileCode2,
} from "lucide-react";

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });

  // Preserve Tiptap task lists as GFM `- [ ]` / `- [x]`
  td.addRule("tiptapTaskItem", {
    filter: (node) =>
      node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem",
    replacement: (content, node) => {
      const checked =
        (node as HTMLElement).getAttribute("data-checked") === "true";
      const clean = content
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")
        .replace(/\n/gm, "\n  ");
      return `- [${checked ? "x" : " "}] ${clean}\n`;
    },
  });

  td.addRule("tiptapTaskList", {
    filter: (node) =>
      node.nodeName === "UL" && node.getAttribute("data-type") === "taskList",
    replacement: (content) => `\n${content.trim()}\n\n`,
  });

  return td;
}

/**
 * Convert GFM Markdown into Tiptap-compatible HTML (including task lists).
 */
function markdownToTiptapHtml(md: string): string {
  if (!md.trim()) return "";
  const rawHtml = marked.parse(md, { gfm: true, breaks: false, async: false }) as string;

  // Convert marked's `<input disabled="" type="checkbox">` task list items into Tiptap's taskList/taskItem markup
  return rawHtml
    .replace(/<ul>(\s*<li>\s*<input[^>]*type="checkbox"[^>]*>)/gi, '<ul data-type="taskList">$1')
    .replace(
      /<li>\s*<input[^>]*checked[^>]*type="checkbox"[^>]*>\s*/gi,
      '<li data-type="taskItem" data-checked="true"><p>'
    )
    .replace(
      /<li>\s*<input[^>]*type="checkbox"[^>]*checked[^>]*>\s*/gi,
      '<li data-type="taskItem" data-checked="true"><p>'
    )
    .replace(
      /<li>\s*<input[^>]*type="checkbox"[^>]*>\s*/gi,
      '<li data-type="taskItem" data-checked="false"><p>'
    )
    .replace(/(<li data-type="taskItem"[^>]*><p>[\s\S]*?)<\/li>/gi, "$1</p></li>");
}

export function SmartMarkdownEditor({
  value,
  onChange,
  placeholder = 'Type "# Heading", "- list", "[ ] task", or "**bold**"...',
}: {
  value: string;
  onChange: (nextMarkdown: string) => void;
  placeholder?: string;
}) {
  const turndown = useMemo(() => createTurndown(), []);
  const lastEmittedMdRef = useRef<string>(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: markdownToTiptapHtml(value),
    editorProps: {
      attributes: {
        class:
          "tiptap-smart-editor focus:outline-none min-h-full px-4 py-3 text-sm text-slate-100 leading-relaxed",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const nextMd = turndown.turndown(html).trimEnd();
      lastEmittedMdRef.current = nextMd;
      onChange(nextMd);
    },
  });

  // Sync external value changes (e.g., switching from Raw MD tab or switching nodes)
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmittedMdRef.current) {
      lastEmittedMdRef.current = value;
      editor.commands.setContent(markdownToTiptapHtml(value), { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="flex-1 rounded-xl bg-slate-950 border border-slate-700 p-4 text-xs text-slate-500">
        Loading smart editor...
      </div>
    );
  }

  const btnClass = (active: boolean) =>
    `p-1.5 rounded-md text-xs transition-colors ${
      active
        ? "bg-amber-500/25 text-amber-300 border border-amber-400/40"
        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent"
    }`;

  return (
    <div className="flex-1 flex flex-col min-h-0 rounded-xl bg-slate-950 border border-slate-700 focus-within:border-amber-400 overflow-hidden">
      {/* Compact Formatting Toolbar */}
      <div className="flex items-center flex-wrap gap-1 px-2.5 py-1.5 bg-slate-900/95 border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btnClass(editor.isActive("heading", { level: 1 }))}
          title="Heading 1 (# + space)"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))}
          title="Heading 2 (## + space)"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
          title="Bold (**text**)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
          title="Italic (*text*)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={btnClass(editor.isActive("code"))}
          title="Inline Code (`code`)"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
          title="Bullet List (- + space)"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
          title="Numbered List (1. + space)"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={btnClass(editor.isActive("taskList"))}
          title="Checklist ([ ] + space)"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btnClass(editor.isActive("blockquote"))}
          title="Quote (> + space)"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={btnClass(editor.isActive("codeBlock"))}
          title="Code Block (```)"
        >
          <FileCode2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live WYSIWYG Canvas */}
      <div className="flex-1 overflow-y-auto cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
