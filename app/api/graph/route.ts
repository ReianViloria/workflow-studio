import { NextResponse } from "next/server";
import { DEFAULT_BOARD_ID, saveGraphData } from "@/lib/compile-playbook";
import type { GraphFile } from "@/lib/types";

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("board") || DEFAULT_BOARD_ID;
    const body = (await request.json()) as GraphFile;

    if (!body || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      return NextResponse.json({ error: "Invalid graph payload." }, { status: 400 });
    }

    await saveGraphData({ nodes: body.nodes, edges: body.edges }, boardId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to save graph.json:", error);
    return NextResponse.json({ error: "Failed to persist graph.json." }, { status: 500 });
  }
}
