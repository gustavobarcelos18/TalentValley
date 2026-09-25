/** Decorative, login-only terrain. Motion is CSS-only and desktop-only. */
export function LoginVisualScene() {
  return (
    <div className="tv-login__scene" aria-hidden="true">
      <svg viewBox="0 0 760 620" fill="none" focusable="false">
        <g className="tv-login__contours">
          <path d="M-80 360C70 290 110 420 270 390S470 310 610 370 770 360 850 310" />
          <path d="M-80 402C70 332 120 462 280 432S470 352 620 412 770 402 850 352" />
          <path d="M-80 444C80 374 130 504 290 474S480 394 630 454 780 444 850 394" />
          <path d="M-80 486C90 416 140 546 300 516S490 436 640 496 790 486 850 436" />
          <path d="M-80 528C100 458 150 588 310 558S500 478 650 538 800 528 850 478" />
          <path d="M-80 570C110 500 160 630 320 600S510 520 660 580 810 570 850 520" />
        </g>

        {/* Exact silhouette, polygon divisions and river from TalentValleyMark.
            Only scale, stroke weight and the login palette differ. Keep these
            paths in sync with components/brand/TalentValleyMark.tsx. */}
        <g transform="translate(-14 80) scale(7.7)">
          <g className="tv-login__mountain">
            <path d="M2 46 49 4 66 21 77 14 100 46Z" fill="#008F73" fillOpacity=".18" />
            <path d="m2 46 24-22 12 17Z" fill="#00B838" fillOpacity=".16" />
            <path d="m24 24 25-20-11 37Z" fill="#A0D060" fillOpacity=".52" />
            <path d="m49 4 17 17-28 20Z" fill="#00B838" fillOpacity=".12" />
            <path d="m49 4 7 25 10-8Z" fill="#A0D060" fillOpacity=".66" />
            <path d="m56 29 10-8 11 17-20 8Z" fill="#20C8C0" fillOpacity=".3" />
            <path d="m66 21 11-7 8 15Z" fill="#008F73" fillOpacity=".28" />
            <path d="m77 38 8-9 15 17H57Z" fill="#A0D060" fillOpacity=".24" />
            <path
              className="tv-login__facets"
              d="M2 46 49 4 66 21 77 14 100 46ZM24 24l32 5 21 9M49 4l7 25-18 12L24 24M56 29l10-8 19 8-8 9 23 8M38 41l-36 5m36-5 18-12"
              strokeWidth=".12"
            />
          </g>
          <g className="tv-login__network" strokeWidth=".14">
            <path d="M24 24 56 29 77 38M56 29q15 7 1 17" />
            <path d="M24 24 15 54 57 46 82 59 77 38" />
          </g>
          <g className="tv-login__nodes">
            <circle className="tv-login__node" cx="24" cy="24" r=".6" />
            <circle className="tv-login__node" cx="56" cy="29" r=".85" />
            <circle className="tv-login__node" cx="77" cy="38" r=".6" />
            <circle cx="15" cy="54" r=".4" />
            <circle cx="82" cy="59" r=".4" />
          </g>
        </g>
      </svg>
    </div>
  );
}
