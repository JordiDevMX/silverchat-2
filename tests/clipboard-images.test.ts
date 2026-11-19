import assert from "node:assert/strict";
import test from "node:test";
import {
  extractDataTransferMedia,
  formatClipboardFeedback,
  formatTextOnlyPasteNotice,
  MAX_CLIPBOARD_IMAGE_BYTES,
} from "../src/lib/clipboard-images.ts";

const makeFile = (name: string, type: string, size = 128) =>
  new File([new Uint8Array(size)], name, { type, lastModified: 1700000000000 });

test("extracts single and multiple valid images and deduplicates items vs files", () => {
  const png = makeFile("photo.png", "image/png", 256);
  const jpg = makeFile("snap.jpg", "image/jpg", 512);
  const result = extractDataTransferMedia({
    items: [
      { kind: "file", type: "image/png", getAsFile: () => png },
      { kind: "file", type: "image/jpg", getAsFile: () => jpg },
    ],
    files: [png, jpg],
    getData: () => "",
  });
  assert.equal(result.images.length, 2);
  assert.equal(result.images[0]?.type, "image/png");
  assert.equal(result.images[1]?.type, "image/jpeg");
  assert.equal(result.rejected.length, 0);
  assert.equal(result.overflowCount, 0);
});

test("preserves mixed text alongside pasted images", () => {
  const webp = makeFile("", "image/webp", 100);
  const result = extractDataTransferMedia(
    {
      items: [
        { kind: "string", type: "text/plain", getAsFile: () => null },
        { kind: "file", type: "image/webp", getAsFile: () => webp },
      ],
      getData: (format) => (format === "text/plain" ? "Look at this screenshot" : ""),
    },
    { existingCount: 2 },
  );
  assert.equal(result.plainText, "Look at this screenshot");
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0]?.name, "pasted-image-3.webp");
});

test("resolves safe image extensions with generic MIME and rejects unsupported formats", () => {
  const genericPng = makeFile("clipboard-shot.png", "application/octet-stream", 200);
  const svg = makeFile("vector.svg", "image/svg+xml", 200);
  const heic = makeFile("iphone.heic", "", 200);
  const pdf = makeFile("doc.pdf", "application/pdf", 200);
  const result = extractDataTransferMedia({
    files: [genericPng, svg, heic, pdf],
    getData: () => "",
  });
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0]?.type, "image/png");
  assert.deepEqual(
    result.rejected.map((r) => [r.name, r.reason]),
    [
      ["vector.svg", "unsupported-format"],
      ["iphone.heic", "unsupported-format"],
      ["doc.pdf", "non-image"],
    ],
  );
  assert.equal(result.hasNonImageFiles, true);
});

test("rejects empty files, oversized files, and caps batch/queue limits cleanly", () => {
  const empty = makeFile("empty.png", "image/png", 0);
  const huge = makeFile("huge.png", "image/png", MAX_CLIPBOARD_IMAGE_BYTES + 1);
  const valid1 = makeFile("a.png", "image/png", 100);
  const valid2 = makeFile("b.png", "image/png", 100);
  const valid3 = makeFile("c.png", "image/png", 100);

  const result = extractDataTransferMedia(
    { files: [empty, huge, valid1, valid2, valid3], getData: () => "" },
    { maxCount: 10, existingCount: 8 },
  );
  assert.equal(result.images.length, 2);
  assert.equal(result.overflowCount, 1);
  assert.deepEqual(
    result.rejected.map((r) => r.reason),
    ["empty-file", "too-large", "limit-exceeded"],
  );
  const msgEn = formatClipboardFeedback(result, "en", { maxCount: 10 });
  const msgEs = formatClipboardFeedback(result, "es", { maxCount: 10 });
  assert.match(msgEn, /25 MB/);
  assert.match(msgEn, /Up to 10 images/);
  assert.match(msgEs, /25 MB/);
  assert.match(msgEs, /Máximo 10 imágenes/);
});

test("decodes HTML base64 data URI fallback when file items are absent", () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
  const result = extractDataTransferMedia({
    getData: (format) =>
      format === "text/html" ? `<img src="data:image/png;base64,${bytes}" alt="shot">` : "",
  });
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0]?.type, "image/png");
  assert.equal(result.images[0]?.size, 8);

  const svgHtml = extractDataTransferMedia({
    getData: (format) =>
      format === "text/html" ? '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">' : "",
  });
  assert.equal(svgHtml.images.length, 0);
  assert.equal(svgHtml.rejected[0]?.reason, "unsupported-format");
});

test("flags blocked clipboard image items when browser denies getAsFile()", () => {
  const result = extractDataTransferMedia({
    items: [{ kind: "file", type: "image/png", getAsFile: () => null }],
    getData: () => "",
  });
  assert.equal(result.clipboardBlocked, true);
  assert.equal(result.hadMediaPayload, true);
  assert.match(formatClipboardFeedback(result, "en"), /Clipboard image access was blocked/);
  assert.match(formatClipboardFeedback(result, "es"), /portapapeles/);
});

test("does not duplicate a single clipboard image when items.getAsFile() and files[] yield different lastModified timestamps", () => {
  const result = extractDataTransferMedia({
    items: [
      {
        kind: "file",
        type: "image/png",
        getAsFile: () =>
          new File([new Uint8Array(443)], "image.png", {
            type: "image/png",
            lastModified: 1795111793099,
          }),
      },
    ],
    files: [
      new File([new Uint8Array(443)], "image.png", {
        type: "image/png",
        lastModified: 1795111793095,
      }),
    ],
    getData: () => "",
  });
  assert.equal(result.images.length, 1);
  assert.equal(result.overflowCount, 0);
});

test("formats clear localized notices for every text-only input category", () => {
  assert.match(
    formatTextOnlyPasteNotice("edit-message", false, "en"),
    /Message editing only supports text/,
  );
  assert.match(
    formatTextOnlyPasteNotice("story-text", true, "en"),
    /Pasted text only — text stories don't support images/,
  );
  assert.match(formatTextOnlyPasteNotice("auth-code", false, "es"), /código numérico/);
  assert.match(formatTextOnlyPasteNotice("avatar-hint", true, "es"), /Cambiar foto/);
});
