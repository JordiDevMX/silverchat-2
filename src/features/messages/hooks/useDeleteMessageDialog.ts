import { useState } from "react";
export function useDeleteMessageDialog(
  onDelete: (everyone: boolean) => Promise<void>,
  onClose: () => void,
) {
  const [error, setError] = useState(false);
  const remove = async (all: boolean) => {
    setError(false);
    try {
      await onDelete(all);
      onClose();
    } catch {
      setError(true);
    }
  };
  return { error, remove };
}
