import { CheckCircle2, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { promptInstall, useInstallStatus } from "@/lib/pwa-install";

export function InstallPwaButton() {
  const [open, setOpen] = useState(false);
  const status = useInstallStatus();
  const notify = useChatUIStore((s) => s.notify);
  const { say } = useMessageText();
  if (status === "installed") return null;
  const install = async () => {
    setOpen(false);
    const outcome = await promptInstall();
    if (outcome === "accepted")
      notify(
        say(
          "Installation accepted. Look for SilverChat in your apps.",
          "Instalación aceptada. Busca SilverChat entre tus aplicaciones.",
        ),
      );
    if (outcome === "error")
      notify(
        say(
          "The install prompt could not open. Try installing from your browser menu.",
          "No se pudo abrir la instalación. Intenta instalar desde el menú del navegador.",
        ),
      );
  };
  const label = say("Install SilverChat", "Instalar SilverChat");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="install-button"
          aria-label={label}
          title={label}
          disabled={status === "prompting"}
        >
          {say("Install", "Instalar")}
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-w-[22rem] gap-4 rounded-2xl border-border/70 bg-card/90 p-5 backdrop-blur-2xl sm:rounded-2xl"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-neon text-primary-foreground shadow-glow">
          <Download aria-hidden="true" />
        </div>
        <div className="space-y-1.5 text-center">
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {say(
              "Keep your chats a tap away on this device.",
              "Ten tus chats a un toque en este dispositivo.",
            )}
          </DialogDescription>
        </div>
        <ul className="grid gap-2.5 text-sm">
          {[
            say(
              "Launch SilverChat from your home screen or app list.",
              "Abre SilverChat desde tu pantalla de inicio o lista de aplicaciones.",
            ),
            say(
              "Use a dedicated window without browser tabs.",
              "Usa una ventana propia sin pestañas del navegador.",
            ),
            say(
              "Keep text drafts on this device when your connection drops.",
              "Conserva borradores de texto en este dispositivo si pierdes la conexión.",
            ),
          ].map((benefit) => (
            <li key={benefit} className="flex items-start gap-2">
              <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-neon" />
              {benefit}
            </li>
          ))}
        </ul>
        {status === "manual" && (
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            {say(
              "If your browser offers installation, choose Install app from its menu or Add to Home Screen from the Share menu.",
              "Si tu navegador permite instalar, elige Instalar aplicación en su menú o Añadir a inicio desde Compartir.",
            )}
          </p>
        )}
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="flex-1 cursor-pointer">
              {status === "ready" ? say("Not now", "Ahora no") : say("Got it", "Entendido")}
            </Button>
          </DialogClose>
          {status === "ready" && (
            <Button type="button" className="flex-1 cursor-pointer shadow-glow" onClick={install}>
              <Download size={16} />
              {say("Install", "Instalar")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
