import React from "react";
import {
  compilePlaybook,
  DEFAULT_BOARD_ID,
  listBoards,
  listTemplates,
  readPlaybookData,
} from "@/lib/compile-playbook";
import { PlaybookCanvas } from "@/components/PlaybookCanvas";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ board?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const [boards, templates] = await Promise.all([listBoards(), listTemplates()]);
  const activeBoardId =
    resolvedParams.board && boards.some((b) => b.id === resolvedParams.board)
      ? resolvedParams.board
      : DEFAULT_BOARD_ID;

  const initialData = await readPlaybookData(activeBoardId);
  await compilePlaybook(activeBoardId);

  return (
    <PlaybookCanvas
      initialData={initialData}
      initialBoards={boards}
      initialTemplates={templates}
    />
  );
}
