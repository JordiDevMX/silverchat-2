import assert from "node:assert/strict";
import test from "node:test";
import { matchDeviceLanguage } from "../src/lib/language.ts";

test("device tags resolve to the closest supported language", () => {
  assert.equal(matchDeviceLanguage(["es-ES"]), "es");
  assert.equal(matchDeviceLanguage(["es-MX", "en-US"]), "es");
  assert.equal(matchDeviceLanguage(["en-GB"]), "en");
  assert.equal(matchDeviceLanguage(["ES-es"]), "es");
});

test("unsupported tags are skipped until a supported language shows up", () => {
  assert.equal(matchDeviceLanguage(["fr-FR", "es-ES"]), "es");
  assert.equal(matchDeviceLanguage(["fr-FR", "de-DE"]), "en");
  assert.equal(matchDeviceLanguage([]), "en");
});

test("the fallback applies when no tag is supported", () => {
  assert.equal(matchDeviceLanguage(["fr"], "es"), "es");
});
