import { useId } from "react";

/** Decorative, theme-aware tiled line-art backdrop inspired by classic chat wallpapers. */
export function ChatDoodlePattern() {
  const id = useId();
  const patternId = `chat-doodle-${id.replace(/:/g, "")}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-slot="chat-doodle-pattern"
      className="conversation-doodle-pattern"
    >
      <defs>
        <pattern id={patternId} width="240" height="240" patternUnits="userSpaceOnUse">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Chat bubble */}
            <g transform="translate(18 16) rotate(-10)">
              <path d="M4 12a9 7.5 0 1 1 3.6 6L3 20l1.6-4.2A7 7 0 0 1 4 12Z" />
              <path d="M9.5 11.5h.01M13 11.5h.01M16.5 11.5h.01" />
            </g>
            {/* Paper plane */}
            <g transform="translate(86 14) rotate(12)">
              <path d="M2 10 20 3l-5 16-4.2-5.5L2 10Z" />
              <path d="M20 3 10.8 13.5" />
            </g>
            {/* Coffee cup */}
            <g transform="translate(152 18) rotate(-6)">
              <path d="M4 9h11v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
              <path d="M15 10.5h2.5a2 2 0 0 1 0 4H15" />
              <path d="M7.5 5.5c0-1.5 1.5-1.5 1.5-3M11.5 5.5c0-1.5 1.5-1.5 1.5-3" />
            </g>
            {/* Star */}
            <g transform="translate(206 20) rotate(15)">
              <path d="m10 2 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L10 2Z" />
            </g>

            {/* Camera */}
            <g transform="translate(46 72) rotate(8)">
              <rect x="2" y="6" width="18" height="13" rx="3" />
              <path d="M7 6 8.5 3.5h5L15 6" />
              <circle cx="11" cy="12.5" r="3.2" />
            </g>
            {/* Music note */}
            <g transform="translate(116 68) rotate(-12)">
              <path d="M9 16V5l10-2v11" />
              <circle cx="6.5" cy="16.5" r="2.5" />
              <circle cx="16.5" cy="14.5" r="2.5" />
            </g>
            {/* Smile */}
            <g transform="translate(182 76) rotate(6)">
              <circle cx="10" cy="10" r="8.5" />
              <path d="M7 8.5h.01M13 8.5h.01" />
              <path d="M6.8 12.5a4 4 0 0 0 6.4 0" />
            </g>

            {/* Phone handset */}
            <g transform="translate(16 128) rotate(14)">
              <path d="M5.5 3h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3Z" />
            </g>
            {/* Heart */}
            <g transform="translate(84 128) rotate(-8)">
              <path d="M11 19s-7.5-4.8-7.5-10a4.3 4.3 0 0 1 7.5-2.8A4.3 4.3 0 0 1 18.5 9c0 5.2-7.5 10-7.5 10Z" />
            </g>
            {/* Headphones */}
            <g transform="translate(148 126) rotate(9)">
              <path d="M3.5 13v-1a7.5 7.5 0 0 1 15 0v1" />
              <rect x="2.5" y="12.5" width="3.5" height="6" rx="1.5" />
              <rect x="16" y="12.5" width="3.5" height="6" rx="1.5" />
            </g>
            {/* Bell */}
            <g transform="translate(206 132) rotate(-14)">
              <path d="M15 14H5l1.2-1.8V9a4.8 4.8 0 1 1 9.6 0v3.2L17 14h-2Z" />
              <path d="M9.5 17a1.8 1.8 0 0 0 3 0" />
            </g>

            {/* Envelope */}
            <g transform="translate(36 188) rotate(-7)">
              <rect x="2" y="5" width="18" height="12" rx="2" />
              <path d="m3 6 8 6 8-6" />
            </g>
            {/* Clock */}
            <g transform="translate(106 186) rotate(10)">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 5.5V10l3 2" />
            </g>
            {/* Globe */}
            <g transform="translate(168 188) rotate(-9)">
              <circle cx="10" cy="10" r="8" />
              <path d="M2.5 10h15M10 2a12 12 0 0 1 0 16M10 2a12 12 0 0 0 0 16" />
            </g>
            {/* Lock */}
            <g transform="translate(212 192) rotate(12)">
              <rect x="3" y="9" width="12" height="9" rx="2" />
              <path d="M6 9V6.5a3 3 0 0 1 6 0V9" />
            </g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
