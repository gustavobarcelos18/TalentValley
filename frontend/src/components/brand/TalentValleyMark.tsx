/** Original aspect ratio of the Talent Valley geometric mark. */
const MARK_WIDTH = 102;
const MARK_HEIGHT = 50;

interface TalentValleyMarkProps {
  /** Rendered width in pixels; the height follows the original 102:50 aspect ratio. */
  width?: number;
}

/**
 * Official Talent Valley geometric mark, shared by the public landing page and
 * the authenticated application. Purely decorative: the visible wordmark
 * carries the text identity.
 */
export function TalentValleyMark({ width = MARK_WIDTH }: TalentValleyMarkProps) {
  return (
    <svg
      width={width}
      height={Math.round((width * MARK_HEIGHT) / MARK_WIDTH)}
      viewBox="0 0 102 50"
      fill="none"
      aria-hidden="true"
    >
      <path d="M2 46 49 4 66 21 77 14 100 46Z" fill="#008F73" />
      <path d="m2 46 24-22 12 17Z" fill="#00B838" />
      <path d="m24 24 25-20-11 37Z" fill="#A0D060" />
      <path d="m49 4 17 17-28 20Z" fill="#00B838" />
      <path d="m49 4 7 25 10-8Z" fill="#D8E9B8" />
      <path d="m56 29 10-8 11 17-20 8Z" fill="#20C8C0" />
      <path d="m66 21 11-7 8 15Z" fill="#73BB40" />
      <path d="m77 38 8-9 15 17H57Z" fill="#A0D060" />
      <path
        d="M2 46 49 4 66 21 77 14 100 46ZM24 24l32 5 21 9M49 4l7 25-18 12L24 24M56 29l10-8 19 8-8 9 23 8M38 41l-36 5m36-5 18-12"
        stroke="currentColor"
        strokeOpacity=".7"
        strokeWidth=".8"
      />
      <path d="M56 29q15 7 1 17" stroke="#F4F7F6" strokeWidth="2" />
      <circle cx="24" cy="24" r="2" fill="#F4F7F6" />
      <circle cx="56" cy="29" r="3" fill="#F4F7F6" />
      <circle cx="77" cy="38" r="2" fill="#F4F7F6" />
    </svg>
  );
}
