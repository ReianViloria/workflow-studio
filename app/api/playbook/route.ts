import { NextResponse } from "next/server";
import { DEFAULT_BOARD_ID, readPlaybookData } from "@/lib/compile-playbook";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("board") || DEFAULT_BOARD_ID;
    const payload = await readPlaybookData(boardId);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Failed to read board data:", error);
    return NextResponse.json({ error: "Failed to read board data from disk." }, { status: 500 });
  }
}
