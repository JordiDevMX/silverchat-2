import { useState } from "react";
export function useEditMessageDialog(
  initial: string,
  onSave: (text: string) => Promise<void>,
  onClose: () => void,
) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState(false);
  const save = async () => {
    setError(false);
    try {
      await onSave(text);
      onClose();
    } catch {
      setError(true);
    }
  };
  return { text, setText, error, save };
}
