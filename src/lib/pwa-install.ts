import { useSyncExternalStore } from "react";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const changes = new EventTarget();
let pending: InstallPrompt | undefined;
let installed = false;
let prompting = false;

export function listenForPwaInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pending = event as InstallPrompt;
    changes.dispatchEvent(new Event("change"));
  });
  window.addEventListener("appinstalled", () => {
    pending = undefined;
    installed = true;
    changes.dispatchEvent(new Event("change"));
  });
}

const standalone = window.matchMedia("(display-mode: standalone)");
function subscribe(notify: () => void) {
  changes.addEventListener("change", notify);
  standalone.addEventListener("change", notify);
  return () => {
    changes.removeEventListener("change", notify);
    standalone.removeEventListener("change", notify);
  };
}

function status() {
  if (
    installed ||
    standalone.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone
  )
    return "installed";
  if (prompting) return "prompting";
  return pending ? "ready" : "manual";
}

export function useInstallStatus() {
  return useSyncExternalStore(subscribe, status);
}

export async function promptInstall() {
  const event = pending;
  if (!event || prompting) return;
  pending = undefined;
  prompting = true;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") installed = true;
    return outcome;
  } catch {
    return "error";
  } finally {
    prompting = false;
    changes.dispatchEvent(new Event("change"));
  }
}
