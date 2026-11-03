export type FileFamily = "pdf" | "spreadsheet" | "word" | "presentation" | "text" | "unknown";

const labels = {
  pdf: ["PDF Document", "Documento PDF"],
  spreadsheet: ["Spreadsheet", "Hoja de cálculo"],
  word: ["Word Document", "Documento Word"],
  presentation: ["Presentation", "Presentación"],
  text: ["Text / Notes", "Texto / Notas"],
  unknown: ["File", "Archivo"],
} as const;

const mimeFamilies: Readonly<Record<string, FileFamily>> = {
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "text/csv": "spreadsheet",
  "application/csv": "spreadsheet",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.ms-powerpoint": "presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "presentation",
  "text/plain": "text",
  "text/markdown": "text",
  "application/onenote": "text",
};

const extensionFamilies: Readonly<Record<string, FileFamily>> = {
  pdf: "pdf",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  csv: "spreadsheet",
  doc: "word",
  docx: "word",
  ppt: "presentation",
  pptx: "presentation",
  txt: "text",
  one: "text",
  md: "text",
  markdown: "text",
};

/** Metadata describes the upload; it is not a content inspection or safety verdict.
 * A specific, unrecognized MIME stays neutral even when the filename looks familiar.
 */
export function resolveFileType({
  mimeType,
  filename,
}: {
  mimeType?: string | null;
  filename?: string | null;
}) {
  const mime = mimeType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const generic = !mime || mime === "application/octet-stream" || mime === "binary/octet-stream";
  const extension = filename?.match(/\.([^.\s/\\]+)$/)?.[1]?.toLowerCase() ?? "";
  const family = generic
    ? Object.hasOwn(extensionFamilies, extension)
      ? (extensionFamilies[extension] ?? "unknown")
      : "unknown"
    : Object.hasOwn(mimeFamilies, mime)
      ? (mimeFamilies[mime] ?? "unknown")
      : "unknown";
  return { family, label: labels[family] };
}
