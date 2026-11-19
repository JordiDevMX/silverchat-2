import { Camera, FileText, Image, UserRound, X } from "lucide-react";
import { useRef } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "../i18n";
export function AttachmentMenu({
  onFile,
  onFiles,
  onContact,
  onClose,
}: {
  onFile: (file: File) => void;
  onFiles?: (files: File[]) => void;
  onContact: () => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { say } = useMessageText();
  const choose = (kind: "media" | "camera" | "file") => {
    if (!input.current) return;
    input.current.accept = kind === "file" ? "*/*" : "image/*,video/*";
    input.current.multiple = kind === "media" && Boolean(onFiles);
    if (kind === "camera") input.current.setAttribute("capture", "environment");
    else input.current.removeAttribute("capture");
    input.current.click();
  };
  return (
    <Modal
      title={say("Attach", "Adjuntar")}
      className="attachment-menu messaging-dialog"
      onClose={onClose}
    >
      <button
        className="message-icon modal-close"
        type="button"
        onClick={onClose}
        aria-label={say("Close", "Cerrar")}
      >
        <X />
      </button>
      <div className="attachment-options">
        <button type="button" onClick={() => choose("media")}>
          <Image />
          <span>{say("Photo / Video", "Foto / Video")}</span>
        </button>
        <button type="button" onClick={() => choose("camera")}>
          <Camera />
          <span>{say("Camera", "Cámara")}</span>
        </button>
        <button type="button" onClick={() => choose("file")}>
          <FileText />
          <span>{say("File", "Archivo")}</span>
        </button>
        <button type="button" onClick={onContact}>
          <UserRound />
          <span>{say("Contact", "Contacto")}</span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 1 && onFiles) onFiles(files);
          else if (files[0]) onFile(files[0]);
          e.target.value = "";
        }}
      />
    </Modal>
  );
}
