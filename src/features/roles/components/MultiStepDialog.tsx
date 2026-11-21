import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export interface MultiStepDialogStep {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
  nextLabel?: string;
  skipLabel?: string;
  canProceed?: boolean;
  onNext?: () => boolean | Promise<boolean>;
  content: ReactNode;
}

export interface MultiStepDialogProps {
  steps: MultiStepDialogStep[];
  currentStep: number;
  onStepChange: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitLabel: string;
  submittingLabel?: string;
  busy?: boolean;
  error?: string | null;
  className?: string;
  canClose?: boolean;
  cancelLabel?: string;
  backLabel?: string;
  nextLabel?: string;
  skipLabel?: string;
}

export function MultiStepDialog({
  steps,
  currentStep,
  onStepChange,
  onClose,
  onSubmit,
  submitLabel,
  submittingLabel,
  busy = false,
  error,
  className,
  canClose = true,
  cancelLabel = "Cancel",
  backLabel = "Back",
  nextLabel = "Next",
  skipLabel = "Skip",
}: MultiStepDialogProps) {
  const safeIndex = Math.max(0, Math.min(currentStep, steps.length - 1));
  const step = steps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === steps.length - 1;
  if (!step) return null;

  const advance = async () => {
    if (busy) return;
    if (step.onNext) {
      const ok = await step.onNext();
      if (!ok) return;
    }
    if (isLast) {
      await onSubmit();
    } else {
      onStepChange(safeIndex + 1);
    }
  };

  return (
    <Modal
      title={step.title}
      onClose={canClose && !busy ? onClose : undefined}
      className={className}
    >
      <div className="flex max-h-[85dvh] flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              Step {safeIndex + 1} of {steps.length}
            </p>
            {step.description && (
              <p className="text-sm text-muted-foreground">{step.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 pt-1" aria-hidden="true">
            {steps.map((s, idx) => (
              <span
                key={s.id}
                className={
                  idx === safeIndex
                    ? "h-1.5 w-5 rounded-full bg-primary transition-all"
                    : idx < safeIndex
                      ? "h-1.5 w-2 rounded-full bg-primary/50"
                      : "h-1.5 w-2 rounded-full bg-muted"
                }
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{step.content}</div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div>
            {isFirst ? (
              <Button variant="outline" type="button" disabled={busy} onClick={onClose}>
                {cancelLabel}
              </Button>
            ) : (
              <Button
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => onStepChange(safeIndex - 1)}
              >
                <ChevronLeft size={16} />
                {backLabel}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLast && step.optional && (
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => onStepChange(safeIndex + 1)}
              >
                {step.skipLabel ?? skipLabel}
              </Button>
            )}
            <Button
              type="button"
              disabled={busy || step.canProceed === false}
              onClick={() => void advance()}
            >
              {isLast
                ? busy
                  ? (submittingLabel ?? submitLabel)
                  : submitLabel
                : (step.nextLabel ?? nextLabel)}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
