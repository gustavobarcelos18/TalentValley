import { useId } from "react";

/** Static vector layers, ready for scoped motion in Phase 2. */
export function ValleyScene({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={compact ? "valley-scene compact" : "valley-scene"} viewBox="0 0 1440 680" fill="none" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`${id}-facet`} x1="100" y1="220" x2="600" y2="650" gradientUnits="userSpaceOnUse"><stop stopColor="var(--scene-lime)" /><stop offset=".5" stopColor="var(--scene-teal)" /><stop offset="1" stopColor="var(--scene-deep)" /></linearGradient>
        <linearGradient id={`${id}-right`} x1="1360" y1="170" x2="850" y2="680" gradientUnits="userSpaceOnUse"><stop stopColor="var(--scene-teal)"/><stop offset=".45" stopColor="var(--scene-deep)"/><stop offset="1" stopColor="var(--scene-teal)"/></linearGradient>
        <linearGradient id={`${id}-river`} x1="730" y1="350" x2="700" y2="680" gradientUnits="userSpaceOnUse"><stop stopColor="#A0D060" stopOpacity="0" /><stop offset="1" stopColor="#20C8C0" stopOpacity=".7" /></linearGradient>
        <radialGradient id={`${id}-glow`}><stop stopColor="#A0D060" stopOpacity=".7"/><stop offset="1" stopColor="#00A898" stopOpacity="0"/></radialGradient>
      </defs>
      <g data-scene-layer="distant" stroke="var(--scene-line)" strokeWidth=".7" fill="var(--scene-deep)" opacity=".55">
        <path d="M-80 340 70 180 240 310 340 230 520 380 620 340 735 455 830 360 915 395 1120 235 1220 290 1370 190 1510 370V680H-80Z"/>
        <path d="m70 180 90 270 180-220 55 270 125-120 215 75 180-60 105 100 100-260 100 225 150-270"/>
      </g>
      <g data-scene-layer="facets" fill={`url(#${id}-facet)`} stroke="var(--scene-line)" strokeWidth=".8">
        <path d="M-80 180 110 100 265 255 405 365 620 530 750 680H-80Z"/>
        <path d="m-80 180 190-80-35 240Z" opacity=".6"/><path d="m110 100 155 155-190 85Z" opacity=".9"/><path d="m75 340 190-85 20 215Z" opacity=".5"/><path d="m265 255 140 110-120 105Z" opacity=".8"/><path d="m-80 180 155 160-155 180Z" opacity=".4"/><path d="m75 340 210 130-175 160Z" opacity=".6"/><path d="m285 470 120-105 215 165Z" opacity=".5"/><path d="m110 630 175-160 465 210Z" opacity=".8"/>
        <path d="M1510 140 1350 130 1200 295 1040 370 880 545 730 680H1510Z" fill={`url(#${id}-right)`}/>
        <path d="m1350 130 160 10-75 210Z" opacity=".6"/><path d="m1350 130-150 165 235 55Z" opacity=".9"/><path d="m1200 295-160 75 100 150Z" opacity=".6"/><path d="m1200 295 235 55-295 170Z" opacity=".4"/><path d="m1435 350-295 170 370 100Z" opacity=".8"/><path d="m1040 370-160 175 260-25Z" opacity=".5"/><path d="m880 545 260-25-100 160H730Z" opacity=".6"/>
      </g>
      <g data-scene-layer="mesh" stroke="var(--scene-line)" strokeWidth=".7">
        <path d="m110 100 70 147-105 93Z" fill="var(--scene-teal)" fillOpacity=".6"/>
        <path d="m180 247 85 8-41 121Z" fill="var(--scene-lime)" fillOpacity=".5"/>
        <path d="m75 340 149 36-82 108Z" fill="var(--scene-deep)" fillOpacity=".55"/>
        <path d="m224 376 61 94 120-105Z" fill="var(--scene-teal)" fillOpacity=".6"/>
        <path d="m285 470 171 32-36 95Z" fill="var(--scene-lime)" fillOpacity=".12"/>
        <path d="m1350 130-34 142 119 78Z" fill="var(--scene-lime)" fillOpacity=".45"/>
        <path d="m1316 272-116 23 66 120Z" fill="var(--scene-teal)" fillOpacity=".8"/>
        <path d="m1266 415 169-65-79 140Z" fill="var(--scene-deep)" fillOpacity=".65"/>
        <path d="m1200 295-60 225 126-105Z" fill="var(--scene-lime)" fillOpacity=".16"/>
        <path d="m1040 370-29 143 129 7Z" fill="var(--scene-teal)" fillOpacity=".7"/>
      </g>
      <g data-scene-layer="contours" stroke="var(--scene-line)" strokeWidth=".8" opacity=".55">
        {Array.from({ length: compact ? 13 : 24 }, (_, i) => <path key={i} d={`M-50 ${330+i*14} C120 ${265+i*12} 180 ${490+i*7} 340 ${430+i*10} S490 ${540+i*6} 655 ${605+i*6} M790 ${620+i*5} C940 ${560+i*5} 1020 ${370+i*10} 1160 ${440+i*8} S1330 ${290+i*13} 1500 ${320+i*14}`} />)}
      </g>
      <path data-scene-layer="river" d="M731 427C620 480 839 490 716 540S640 602 806 690" stroke={`url(#${id}-river)`} strokeWidth="17" />
      <path d="M731 427C620 480 839 490 716 540S640 602 806 690" stroke="var(--scene-line)" strokeWidth="1.5" />
      <g data-scene-layer="connections" stroke="var(--scene-node)" strokeWidth="1" opacity=".75">
        <path d="M190 355Q330 190 465 470Q620 300 735 525Q910 285 1075 425Q1190 180 1315 310"/>
        <path d="M465 470Q755 355 1075 425M190 355 465 470 735 525 1075 425 1315 310" strokeDasharray="3 7"/>
      </g>
      {[[190,355],[465,470],[735,525],[1075,425],[1315,310]].map(([x,y]) => <g key={x}><circle cx={x} cy={y} r="38" fill={`url(#${id}-glow)`}/><circle cx={x} cy={y} r="4" fill="var(--scene-node)"/><circle cx={x} cy={y} r="9" stroke="var(--scene-node)" strokeOpacity=".4"/></g>)}
    </svg>
  );
}
