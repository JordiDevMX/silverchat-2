// Device language detection and the Spanish public surface; mocked auth/data boundaries only.
import assert from "node:assert/strict";
import { launchBrowser } from "./lib/browser.mjs";

const browser = await launchBrowser({ args: ["--no-sandbox"] });
const origin = process.env.UI_BASE_URL ?? "http://127.0.0.1:5175";
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "es-ES",
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
await page.route("**/api/auth/**", async (route) =>
  route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "no_session" }),
  }),
);
await page.route("https://supabase.test/**", async (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
);

await page.goto(`${origin}/auth/login`);
await page.getByRole("heading", { name: "Bienvenido de nuevo" }).waitFor();
assert.equal(await page.evaluate(() => navigator.language), "es-ES");
assert.equal(await page.evaluate(() => document.documentElement.lang), "es");
await page.getByLabel("Correo electrónico").waitFor();
await page.getByRole("button", { name: "Enviar enlace mágico" }).waitFor();
await page.getByText("¿No tienes cuenta?").waitFor();
assert.equal(
  await page.evaluate(() => localStorage.getItem("silverchat_language")),
  null,
  "the provider must not cache a language before the user chooses one",
);
console.log("PASS the login page follows the device language");

// A language cached by an earlier session never overrides the device.
await page.evaluate(() => localStorage.setItem("silverchat_language", "en"));
await page.reload();
await page.getByRole("heading", { name: "Bienvenido de nuevo" }).waitFor();
assert.equal(await page.evaluate(() => document.documentElement.lang), "es");
console.log("PASS a stale cached language does not mask the device language");

// An explicit choice does override the device.
await page.evaluate(() => {
  localStorage.setItem("silverchat_language", "en");
  localStorage.setItem("silverchat_language_chosen", "1");
});
await page.reload();
await page.getByRole("heading", { name: "Welcome back" }).waitFor();
assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
console.log("PASS an explicit choice wins over the device language");

await page.evaluate(() => localStorage.clear());
await page.goto(`${origin}/`);
await page.getByRole("heading", { name: /Las buenas conversaciones/ }).waitFor();
await page.getByRole("link", { name: "Iniciar sesión" }).first().waitFor();
await page.goto(`${origin}/auth/signup`);
await page.getByRole("heading", { name: "Crea tu cuenta" }).waitFor();
await page.goto(`${origin}/auth/error?code=expired_token`);
await page.getByRole("heading", { name: "Este enlace ha expirado." }).waitFor();
console.log("PASS the public surfaces render in Spanish");

assert.deepEqual(failures, []);
await browser.close();
