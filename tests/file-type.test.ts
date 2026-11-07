import assert from "node:assert/strict";
import test from "node:test";
import { resolveFileType } from "../src/lib/file-type.ts";

test("file family prefers stored MIME over a renamed extension", () => {
  assert.equal(
    resolveFileType({ filename: "invoice.pdf", mimeType: "application/vnd.ms-excel" }).family,
    "spreadsheet",
  );
  assert.equal(
    resolveFileType({ filename: "notes.txt", mimeType: " APPLICATION/PDF ; charset=binary" })
      .family,
    "pdf",
  );
  assert.equal(
    resolveFileType({ filename: "invoice.pdf", mimeType: "application/x-executable" }).family,
    "unknown",
  );
  assert.equal(
    resolveFileType({ filename: "invoice.pdf", mimeType: "image/png" }).family,
    "unknown",
  );
});

test("missing and generic MIME fall back to supported extensions only", () => {
  const families = {
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
  for (const [extension, family] of Object.entries(families)) {
    for (const mimeType of [undefined, "", "application/octet-stream", "binary/octet-stream"]) {
      assert.equal(
        resolveFileType({ filename: `notes.${extension.toUpperCase()}`, mimeType }).family,
        family,
      );
    }
  }
  for (const filename of [
    undefined,
    "",
    "pdf",
    "report.pdf.exe",
    "report.",
    "report.custom",
    "file.constructor",
    "file.__proto__",
  ]) {
    assert.equal(resolveFileType({ filename }).family, "unknown");
  }
});

test("common document MIME types provide English and Spanish labels without a filename", () => {
  for (const [mimeType, family] of [
    ["application/pdf", "pdf"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "spreadsheet"],
    ["text/csv", "spreadsheet"],
    ["application/msword", "word"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "word"],
    ["application/vnd.ms-powerpoint", "presentation"],
    ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "presentation"],
    ["text/plain", "text"],
    ["text/markdown", "text"],
    ["application/onenote", "text"],
  ]) {
    const result = resolveFileType({ mimeType });
    assert.equal(result.family, family);
    assert.equal(result.label.length, 2);
    assert.ok(result.label.every(Boolean));
  }
  assert.deepEqual(resolveFileType({}).label, ["File", "Archivo"]);
});
