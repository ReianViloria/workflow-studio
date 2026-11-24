import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { compilePlaybook, DEFAULT_BOARD_ID, sanitizeSlug, saveNodeContent } from "@/lib/compile-playbook";
import type { NodeStatus } from "@/lib/types";

export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("board") || DEFAULT_BOARD_ID;
    const { slug } = await context.params;
    const body = (await request.json()) as {
      markdown: string;
      title?: string;
      category?: string;
      status?: NodeStatus;
      isPaidAddon?: boolean;
      summary?: string;
    };

    if (typeof body.markdown !== "string") {
      return NextResponse.json({ error: "Invalid payload: markdown string is required." }, { status: 400 });
    }

    await saveNodeContent(
      slug,
      body.markdown,
      {
        title: body.title,
        category: body.category,
        status: body.status,
        isPaidAddon: body.isPaidAddon,
        summary: body.summary,
      },
      boardId
    );

    return NextResponse.json({ ok: true, slug: sanitizeSlug(slug) }, { status: 200 });
  } catch (error) {
    console.error("Failed to save node content:", error);
    return NextResponse.json({ error: "Failed to save Markdown file." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("board") || DEFAULT_BOARD_ID;
    const { slug } = await context.params;
    const safeSlug = sanitizeSlug(slug);

    if (safeSlug === "root") {
      return NextResponse.json({ error: "Cannot delete root markdown file." }, { status: 400 });
    }

    const mdPath = path.join(process.cwd(), "boards", sanitizeSlug(boardId), "content", `${safeSlug}.md`);
    try {
      await fs.unlink(mdPath);
    } catch {
      // ignore
    }

    await compilePlaybook(boardId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete node content:", error);
    return NextResponse.json({ error: "Failed to delete Markdown file." }, { status: 500 });
  }
}
