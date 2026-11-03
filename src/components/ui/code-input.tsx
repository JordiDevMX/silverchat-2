import { useRef } from "react";
import { Input } from "./input";

export function CodeInput({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const positions = [0, 1, 2, 3, 4, 5];
  return (
    <fieldset className="code-field">
      <legend>Authenticator code</legend>
      <div className="code-inputs">
        {positions.map((index) => (
          <Input
            className="h-12 min-w-0 w-0 flex-1 px-1 text-center text-2xl tabular-nums md:text-2xl"
            key={index}
            ref={(input) => {
              refs.current[index] = input;
            }}
            aria-label={`Digit ${index + 1}`}
            aria-invalid={invalid}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            value={value[index] ?? ""}
            maxLength={6}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              if (digits.length > 1) {
                onChange(digits.slice(0, 6));
                refs.current[Math.min(digits.length, 5)]?.focus();
                return;
              }
              const next = value.split("");
              next[index] = digits;
              onChange(next.join(""));
              if (digits) refs.current[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !value[index]) refs.current[index - 1]?.focus();
            }}
            onPaste={(event) => {
              event.preventDefault();
              const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              onChange(digits);
              refs.current[Math.min(digits.length, 5)]?.focus();
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
