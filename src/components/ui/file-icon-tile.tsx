import { File, FileSpreadsheet, FileText, NotebookPen, Presentation } from "lucide-react";
import type { FileFamily } from "@/lib/file-type";
import { cn } from "@/lib/utils";

const icons = {
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  word: FileText,
  presentation: Presentation,
  text: NotebookPen,
  unknown: File,
};

/** Decorative companion to the visible, localized file-type label. */
export function FileIconTile({ family, className }: { family: FileFamily; className?: string }) {
  const Icon = icons[family];
  return (
    <span
      aria-hidden="true"
      data-slot="file-icon-tile"
      data-file-family={family}
      className={cn("file-icon-tile", className)}
    >
      <Icon size={24} strokeWidth={1.8} />
    </span>
  );
}
