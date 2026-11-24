import { NextResponse } from "next/server";
import { createProjectBoard, listBoards, listTemplates } from "@/lib/compile-playbook";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [boards, templates] = await Promise.all([listBoards(), listTemplates()]);
    return NextResponse.json({ boards, templates }, { status: 200 });
  } catch (error) {
    console.error("Failed to list boards:", error);
    return NextResponse.json({ error: "Failed to list boards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      blueprintId?: string;
      templateName?: string;
    };
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }
    const result = await createProjectBoard({
      name: body.name,
      blueprintId: body.blueprintId,
      templateName: body.templateName,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project board.";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
