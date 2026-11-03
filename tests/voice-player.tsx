import { useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../src/app/providers/i18n-provider";
import { VoicePlayer } from "../src/features/messages/components/VoicePlayer";
import "../src/styles/globals.css";
import "../src/styles/messages.css";

function PlaybackContract() {
  const [mounted, setMounted] = useState(true);
  return (
    <I18nProvider>
      <div data-player="first">
        <VoicePlayer id="contract-first" url="/contract-audio.wav" peaks={Array(40).fill(60)} />
      </div>
      {mounted && (
        <div data-player="second">
          <VoicePlayer id="contract-second" url="/contract-audio.wav" peaks={Array(40).fill(30)} />
        </div>
      )}
      <div data-player="error">
        <VoicePlayer id="contract-error" url="/contract-invalid.wav" peaks={[]} />
      </div>
      <button type="button" onClick={() => setMounted(false)}>
        Unmount second player
      </button>
    </I18nProvider>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing test root");
createRoot(root).render(<PlaybackContract />);
