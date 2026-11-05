import { Copy, Download } from "lucide-react";
import { Button } from "./button";
/** Presentation only: code generation, hashing and acknowledgment stay in the security workflow. */
export function BackupCodesSurface({
  codes,
  onDownload,
  onCopy,
}: {
  codes: string[];
  onDownload: () => void;
  onCopy: () => void;
}) {
  return (
    <>
      <div className="backup-grid">
        {codes.map((code) => (
          <code key={code}>{code}</code>
        ))}
      </div>
      <div className="button-row">
        <Button variant="outline" onClick={onDownload}>
          <Download size={18} aria-hidden="true" />
          Download .txt
        </Button>
        <Button variant="outline" onClick={onCopy}>
          <Copy size={18} aria-hidden="true" />
          Copy all
        </Button>
      </div>
    </>
  );
}
