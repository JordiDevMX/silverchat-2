import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

/** Request previews are opt-in on each mount, including when the first request arrives. */
export function RequestDisclosure({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <>
      <header>
        <h2 className="w-full">
          <button
            type="button"
            className="request-toggle"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded((value) => !value)}
          >
            {label} <span className="message-request-count">{count}</span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={expanded ? "ml-auto rotate-180" : "ml-auto"}
            />
          </button>
        </h2>
      </header>
      <div id={id} hidden={!expanded}>
        {expanded && children}
      </div>
    </>
  );
}
