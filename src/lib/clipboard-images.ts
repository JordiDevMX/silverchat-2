import type { Language } from "./language.ts";

export const MAX_CLIPBOARD_IMAGES_DEFAULT = 10;
export const MAX_CLIPBOARD_IMAGE_BYTES = 25 * 1024 * 1024;

export const SUPPORTED_CLIPBOARD_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
]);

export const SUPPORTED_CLIPBOARD_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "avif",
]);

const UNSUPPORTED_IMAGE_EXTENSIONS = new Set([
  "svg",
  "heic",
  "heif",
  "tif",
  "tiff",
  "ico",
  "cur",
  "raw",
  "cr2",
  "nef",
  "arw",
  "dng",
  "psd",
]);

const MIME_TO_EXT: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/avif": "avif",
};

const EXT_TO_MIME: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  avif: "image/avif",
};

const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

export type ClipboardRejectionReason =
  | "unsupported-format"
  | "too-large"
  | "empty-file"
  | "non-image"
  | "limit-exceeded";

export interface RejectedClipboardItem {
  name: string;
  mimeType: string;
  size: number;
  reason: ClipboardRejectionReason;
}

export type ClipboardReasonHint =
  | "text-only"
  | "edit-message"
  | "story-text"
  | "story-reply"
  | "search"
  | "auth-code"
  | "avatar-hint";

export interface DataTransferItemLike {
  kind: string;
  type: string;
  getAsFile: () => File | null;
}

export interface DataTransferLike {
  items?: ArrayLike<DataTransferItemLike> | null;
  files?: ArrayLike<File> | null;
  types?: ArrayLike<string> | null;
  getData?: (format: string) => string;
}

export interface ExtractMediaOptions {
  maxCount?: number;
  existingCount?: number;
  maxFileBytes?: number;
  /** When true, rejects non-image files cleanly instead of silently ignoring them. */
  strictImagesOnly?: boolean;
  /** Offset used to disambiguate default names across repeated pastes. */
  nameSequenceStart?: number;
}

export interface DataTransferExtractionResult {
  images: File[];
  rejected: RejectedClipboardItem[];
  overflowCount: number;
  plainText: string;
  hasNonImageFiles: boolean;
  clipboardBlocked: boolean;
  hadMediaPayload: boolean;
}

function fileExtension(name: string): string {
  const match = name.match(/\.([^.\s/\\]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

function normalizeMime(mime: string): string {
  const base = mime.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return base === "image/jpg" ? "image/jpeg" : base;
}

function normalizePastedFile(file: File, normalizedMime: string, index: number): File {
  const ext = MIME_TO_EXT[normalizedMime] ?? "png";
  const rawName = file.name.trim();
  const hasExt = Boolean(fileExtension(rawName));
  const finalName = !rawName
    ? `pasted-image-${index}.${ext}`
    : hasExt
      ? rawName
      : `${rawName}.${ext}`;
  if (file.type === normalizedMime && file.name === finalName) return file;
  return new File([file], finalName, {
    type: normalizedMime,
    lastModified: file.lastModified || Date.now(),
  });
}

function decodeHtmlDataUrlImage(
  html: string,
  maxFileBytes: number,
): {
  file?: File;
  rejected?: RejectedClipboardItem;
} {
  if (!html) return {};
  const match = html.match(/src=["'](data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+))["']/i);
  if (!match) return {};
  const mime = normalizeMime(match[2] ?? "");
  const base64 = (match[3] ?? "").replace(/\s+/g, "");
  if (!SUPPORTED_CLIPBOARD_IMAGE_MIMES.has(mime)) {
    return {
      rejected: {
        name: "pasted-image",
        mimeType: mime,
        size: 0,
        reason: "unsupported-format",
      },
    };
  }
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes === 0) {
    return {
      rejected: { name: "pasted-image", mimeType: mime, size: 0, reason: "empty-file" },
    };
  }
  if (estimatedBytes > maxFileBytes) {
    return {
      rejected: {
        name: "pasted-image",
        mimeType: mime,
        size: estimatedBytes,
        reason: "too-large",
      },
    };
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.byteLength === 0) {
      return {
        rejected: { name: "pasted-image", mimeType: mime, size: 0, reason: "empty-file" },
      };
    }
    if (bytes.byteLength > maxFileBytes) {
      return {
        rejected: {
          name: "pasted-image",
          mimeType: mime,
          size: bytes.byteLength,
          reason: "too-large",
        },
      };
    }
    const ext = MIME_TO_EXT[mime] ?? "png";
    return {
      file: new File([bytes], `pasted-image-1.${ext}`, { type: mime }),
    };
  } catch {
    return {
      rejected: {
        name: "pasted-image",
        mimeType: mime,
        size: 0,
        reason: "unsupported-format",
      },
    };
  }
}

export function extractDataTransferMedia(
  dataTransfer: DataTransferLike | null | undefined,
  options: ExtractMediaOptions = {},
): DataTransferExtractionResult {
  const maxCount = options.maxCount ?? MAX_CLIPBOARD_IMAGES_DEFAULT;
  const existingCount = options.existingCount ?? 0;
  const maxFileBytes = options.maxFileBytes ?? MAX_CLIPBOARD_IMAGE_BYTES;
  const strictImagesOnly = options.strictImagesOnly ?? true;
  const sequenceStart = options.nameSequenceStart ?? existingCount + 1;

  if (!dataTransfer) {
    return {
      images: [],
      rejected: [],
      overflowCount: 0,
      plainText: "",
      hasNonImageFiles: false,
      clipboardBlocked: false,
      hadMediaPayload: false,
    };
  }

  let plainText = "";
  let html = "";
  try {
    plainText = dataTransfer.getData?.("text/plain") ?? "";
  } catch {
    plainText = "";
  }
  try {
    html = dataTransfer.getData?.("text/html") ?? "";
  } catch {
    html = "";
  }

  const rawFiles: File[] = [];
  let clipboardBlocked = false;

  // Prefer DataTransferItemList when available; DataTransfer.files exposes the same
  // underlying files with independent File timestamps in Chromium when constructed lazily.
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i += 1) {
      const item = dataTransfer.items[i];
      if (item?.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) {
        rawFiles.push(file);
      } else if (item.type.toLowerCase().startsWith("image/")) {
        clipboardBlocked = true;
      }
    }
  }

  if (rawFiles.length === 0 && dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i += 1) {
      const file = dataTransfer.files[i];
      if (file) rawFiles.push(file);
    }
  }

  const candidateImages: File[] = [];
  const rejected: RejectedClipboardItem[] = [];
  let hasNonImageFiles = false;

  for (let i = 0; i < rawFiles.length; i += 1) {
    const file = rawFiles[i];
    if (!file) continue;
    const rawMime = normalizeMime(file.type);
    const ext = fileExtension(file.name);
    const isGenericMime =
      !rawMime || rawMime === "application/octet-stream" || rawMime === "binary/octet-stream";

    const resolvedMime = isGenericMime
      ? Object.hasOwn(EXT_TO_MIME, ext)
        ? (EXT_TO_MIME[ext] ?? "")
        : ""
      : rawMime;

    const looksLikeUnsupportedImage =
      (rawMime.startsWith("image/") && !SUPPORTED_CLIPBOARD_IMAGE_MIMES.has(rawMime)) ||
      (isGenericMime && UNSUPPORTED_IMAGE_EXTENSIONS.has(ext));

    if (looksLikeUnsupportedImage) {
      rejected.push({
        name: file.name || "image",
        mimeType: rawMime || ext || "image/unknown",
        size: file.size,
        reason: "unsupported-format",
      });
      continue;
    }

    if (!SUPPORTED_CLIPBOARD_IMAGE_MIMES.has(resolvedMime)) {
      hasNonImageFiles = true;
      if (strictImagesOnly) {
        rejected.push({
          name: file.name || "file",
          mimeType: rawMime || "application/octet-stream",
          size: file.size,
          reason: "non-image",
        });
      }
      continue;
    }

    if (file.size <= 0) {
      rejected.push({
        name: file.name || "image",
        mimeType: resolvedMime,
        size: 0,
        reason: "empty-file",
      });
      continue;
    }

    if (file.size > maxFileBytes) {
      rejected.push({
        name: file.name || "image",
        mimeType: resolvedMime,
        size: file.size,
        reason: "too-large",
      });
      continue;
    }

    candidateImages.push(
      normalizePastedFile(file, resolvedMime, sequenceStart + candidateImages.length),
    );
  }

  // Fallback for rich-text clipboard payloads that embed a single base64 data URI without file items.
  if (rawFiles.length === 0 && !plainText && html) {
    const fallback = decodeHtmlDataUrlImage(html, maxFileBytes);
    if (fallback.file) candidateImages.push(fallback.file);
    else if (fallback.rejected) rejected.push(fallback.rejected);
  }

  const remainingSlots = Math.max(0, maxCount - existingCount);
  const images = candidateImages.slice(0, remainingSlots);
  const overflowCount = Math.max(0, candidateImages.length - images.length);
  for (let i = images.length; i < candidateImages.length; i += 1) {
    const skipped = candidateImages[i];
    if (!skipped) continue;
    rejected.push({
      name: skipped.name,
      mimeType: skipped.type,
      size: skipped.size,
      reason: "limit-exceeded",
    });
  }

  const hadMediaPayload =
    images.length > 0 || rejected.length > 0 || hasNonImageFiles || clipboardBlocked;

  return {
    images,
    rejected,
    overflowCount,
    plainText,
    hasNonImageFiles,
    clipboardBlocked,
    hadMediaPayload,
  };
}

export function isTextInputElement(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof target !== "object") return null;
  const el = target as HTMLElement;
  const tag = el.tagName?.toUpperCase();
  if (tag === "TEXTAREA") return el;
  if (tag === "INPUT") {
    const input = el as HTMLInputElement;
    const type = (input.type ?? "text").toLowerCase();
    return TEXT_INPUT_TYPES.has(type) ? input : null;
  }
  if (el.isContentEditable) return el;
  return null;
}

export function isEditableInputDisabled(el: HTMLElement): boolean {
  if ("disabled" in el && (el as HTMLInputElement | HTMLTextAreaElement).disabled) {
    return true;
  }
  if ("readOnly" in el && (el as HTMLInputElement | HTMLTextAreaElement).readOnly) {
    return true;
  }
  return el.getAttribute("aria-disabled") === "true";
}

export function formatClipboardFeedback(
  result: DataTransferExtractionResult,
  language: Language,
  options?: {
    maxCount?: number;
    maxFileBytes?: number;
    singleImageMode?: boolean;
  },
): string {
  const es = language === "es";
  const maxCount = options?.maxCount ?? MAX_CLIPBOARD_IMAGES_DEFAULT;
  const maxMb = Math.round((options?.maxFileBytes ?? MAX_CLIPBOARD_IMAGE_BYTES) / (1024 * 1024));

  if (result.clipboardBlocked && result.images.length === 0) {
    return es
      ? "El navegador bloqueó el acceso a la imagen del portapapeles. Usa Ctrl+V / Cmd+V o el botón Adjuntar."
      : "Clipboard image access was blocked by the browser. Try Ctrl+V / Cmd+V or the Attach button.";
  }

  const reasons = new Set(result.rejected.map((r) => r.reason));
  const parts: string[] = [];

  if (reasons.has("too-large")) {
    parts.push(
      es
        ? `Algunas imágenes superan el límite de ${maxMb} MB.`
        : `Some images exceed the ${maxMb} MB size limit.`,
    );
  }
  if (reasons.has("unsupported-format")) {
    parts.push(
      es
        ? "Formato de imagen no compatible (usa PNG, JPG, WebP, GIF, BMP o AVIF)."
        : "Unsupported image format (use PNG, JPG, WebP, GIF, BMP, or AVIF).",
    );
  }
  if (reasons.has("empty-file")) {
    parts.push(es ? "La imagen del portapapeles estaba vacía." : "The clipboard image was empty.");
  }
  if (reasons.has("non-image") && result.images.length === 0 && !result.plainText) {
    parts.push(
      es
        ? "Solo se pueden pegar imágenes aquí. Usa Adjuntar para otros archivos."
        : "Only images can be pasted here. Use Attach for other files.",
    );
  }
  if (result.overflowCount > 0) {
    if (options?.singleImageMode) {
      parts.push(
        es
          ? "Solo se puede adjuntar una imagen a la vez; se usó la primera."
          : "Only one image can be attached here; loaded the first image.",
      );
    } else if (result.images.length > 0) {
      parts.push(
        es
          ? `Máximo ${maxCount} imágenes a la vez. Se añadieron ${result.images.length} y se omitieron ${result.overflowCount}.`
          : `Up to ${maxCount} images at once. Added ${result.images.length}; skipped ${result.overflowCount}.`,
      );
    } else {
      parts.push(
        es
          ? `Ya alcanzaste el límite de ${maxCount} imágenes. Quita una para añadir más.`
          : `Image limit reached (${maxCount} max). Remove an image to add more.`,
      );
    }
  }

  return parts.join(" ");
}

export function formatTextOnlyPasteNotice(
  reason: ClipboardReasonHint,
  mixedText: boolean,
  language: Language,
): string {
  const es = language === "es";
  if (mixedText) {
    switch (reason) {
      case "edit-message":
        return es
          ? "Se pegó el texto. Al editar mensajes no se pueden adjuntar imágenes."
          : "Pasted text only — message editing doesn't support images.";
      case "story-text":
        return es
          ? "Se pegó el texto. Las historias de texto no admiten imágenes; cambia a Cámara o Galería."
          : "Pasted text only — text stories don't support images; switch to Camera or Gallery.";
      case "story-reply":
        return es
          ? "Se pegó el texto. Las respuestas a historias solo admiten texto."
          : "Pasted text only — story replies only support text.";
      case "search":
        return es
          ? "Se pegó el texto. Los campos de búsqueda no admiten imágenes."
          : "Pasted text only — search fields don't support images.";
      case "auth-code":
        return es
          ? "Solo se aceptan dígitos del código; las imágenes no son compatibles."
          : "Only code digits are accepted here; images aren't supported.";
      case "avatar-hint":
        return es
          ? "Se pegó el texto. Usa Cambiar foto para subir una imagen."
          : "Pasted text only — use Change photo to upload an image.";
      default:
        return es
          ? "Se pegó solo el texto; este campo no admite imágenes."
          : "Pasted text only — this field doesn't support images.";
    }
  }

  switch (reason) {
    case "edit-message":
      return es
        ? "Al editar un mensaje solo se puede pegar texto, no imágenes."
        : "Message editing only supports text, not images.";
    case "story-text":
      return es
        ? "Las historias de texto solo admiten texto. Cambia a Cámara o Galería para pegar una imagen."
        : "Text stories only support text. Switch to Camera or Gallery to paste an image.";
    case "story-reply":
      return es
        ? "Las respuestas a historias solo admiten texto, no imágenes."
        : "Story replies only support text, not images.";
    case "search":
      return es ? "Los campos de búsqueda solo admiten texto." : "Search fields only support text.";
    case "auth-code":
      return es
        ? "Este campo solo acepta un código numérico, no imágenes."
        : "This field only accepts a numeric code, not images.";
    case "avatar-hint":
      return es
        ? "Este campo de texto no admite imágenes. Usa Cambiar foto para añadir una imagen."
        : "This text field doesn't accept images. Use Change photo to add a photo.";
    default:
      return es
        ? "Este campo solo admite texto, no imágenes."
        : "This field only accepts text, not images.";
  }
}
