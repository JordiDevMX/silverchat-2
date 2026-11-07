import { useState } from "react";
import { useChatText } from "../i18n";
import type { MessageRequest } from "../types";
import { useRequestMutation } from "./useMessageRequests";
export function useMessageRequestActions() {
  const t = useChatText();
  const [decline, setDecline] = useState<MessageRequest | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const mutation = useRequestMutation();
  const run = async (r: MessageRequest, accept: boolean) => {
    setError(false);
    setNotice("");
    try {
      await mutation.run(r, accept);
      setDecline(null);
      setNotice(t(accept ? "Chat request accepted" : "Chat request declined"));
    } catch {
      setError(true);
    }
  };
  return { decline, setDecline, notice, error, mutation, run };
}
