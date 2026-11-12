import React from 'react'

/** Markenpalette (docs/brand-identity.md) - die Zeichnung bleibt in beiden Modi hell. */
const CREME = '#fff3e6'
const BEIGE = '#e6d8c3'
const MACCHIATO = '#928168'
const BRAUN = '#5a2e2a'
const HIGHLIGHT = '#d038ba'
const WEISS = '#ffffff'

const BROTE_OBEN = [50, 98, 146, 194]
const BROTE_MITTE = [48, 112, 176]

function Brezel({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 -4c-3 -7 -13 -6 -13 2c0 7 7 11 13 11s13 -4 13 -11c0 -8 -10 -9 -13 -2z"
        fill={BRAUN}
      />
      <circle cx={-6} cy={-1} r={3} fill={CREME} />
      <circle cx={6} cy={-1} r={3} fill={CREME} />
      <path d="M-3 5.5q3 -4 6 0z" fill={CREME} />
    </g>
  )
}

/**
 * Handgezeichnetes Standbild einer Bäckertheke für das Ladebild: Brotregal,
 * Vitrine, Brezelständer. Reine Zeichnung, kein Abbild des echten Modells,
 * ohne Text.
 */
export default function LadebildIllustration() {
  return (
    <svg
      viewBox="0 0 400 260"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      data-testid="ladebild-illustration"
    >
      <rect width={400} height={260} rx={20} fill={CREME} />
      <path
        d="M0 216h400v24a20 20 0 0 1-20 20H20a20 20 0 0 1-20-20z"
        fill={BEIGE}
      />

      {/* Lampen */}
      <g stroke={BRAUN} strokeWidth={2}>
        <path d="M296 0v40M346 0v28" />
      </g>
      <path d="M282 56a14 16 0 0 1 28 0z" fill={HIGHLIGHT} />
      <path d="M332 44a14 16 0 0 1 28 0z" fill={HIGHLIGHT} />

      {/* Brotregal hinter der Theke */}
      <rect
        x={36}
        y={30}
        width={212}
        height={124}
        rx={5}
        fill={WEISS}
        stroke={MACCHIATO}
        strokeWidth={3}
      />
      {BROTE_OBEN.map((x) => (
        <path key={x} d={`M${x} 66a20 15 0 0 1 40 0z`} fill={MACCHIATO} />
      ))}
      {BROTE_MITTE.map((x) => (
        <path
          key={x}
          d={`M${x} 102a28 14 0 0 1 56 0z`}
          fill={BRAUN}
          opacity={0.78}
        />
      ))}
      <g stroke={CREME} strokeWidth={2} strokeLinecap="round">
        {BROTE_OBEN.map((x) => (
          <path key={x} d={`M${x + 13} 58l4 -4M${x + 21} 58l4 -4`} />
        ))}
        {BROTE_MITTE.map((x) => (
          <path
            key={x}
            d={`M${x + 16} 96l4 -4M${x + 26} 96l4 -4M${x + 36} 96l4 -4`}
          />
        ))}
      </g>
      <g stroke={BRAUN} strokeWidth={3} strokeLinecap="round">
        <path d="M38 66h208M38 102h208" />
      </g>

      {/* Brezelständer */}
      <g stroke={BRAUN} strokeWidth={3} strokeLinecap="round">
        <path d="M306 104v58M286 112h40M294 162h24M290 112v8M322 112v8" />
      </g>
      <Brezel x={290} y={130} />
      <Brezel x={322} y={130} />

      {/* Vitrine */}
      <rect
        x={62}
        y={112}
        width={196}
        height={52}
        rx={7}
        fill={WEISS}
        fillOpacity={0.82}
        stroke={BRAUN}
        strokeWidth={3}
      />
      <path d="M64 138h192" stroke={BRAUN} strokeWidth={2} />
      {[84, 108, 132].map((x) => (
        <circle key={x} cx={x} cy={130} r={7} fill={MACCHIATO} />
      ))}
      {[168, 200, 232].map((x) => (
        <ellipse
          key={x}
          cx={x}
          cy={131}
          rx={11}
          ry={6}
          fill={BRAUN}
          opacity={0.78}
        />
      ))}
      {[78, 112, 146].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={148}
            width={24}
            height={13}
            rx={3}
            fill={BEIGE}
            stroke={BRAUN}
            strokeWidth={2}
          />
          <circle cx={x + 12} cy={147} r={3} fill={HIGHLIGHT} />
        </g>
      ))}
      {[192, 222].map((x) => (
        <path key={x} d={`M${x} 161a12 10 0 0 1 24 0z`} fill={MACCHIATO} />
      ))}

      {/* Theke */}
      <rect x={48} y={168} width={304} height={50} fill={MACCHIATO} />
      <rect x={48} y={178} width={304} height={4} fill={HIGHLIGHT} />
      {[60, 134, 208, 282].map((x) => (
        <rect
          key={x}
          x={x}
          y={190}
          width={58}
          height={20}
          rx={3}
          fill={CREME}
          opacity={0.28}
        />
      ))}
      <rect x={42} y={162} width={316} height={10} rx={3} fill={BRAUN} />
      <rect x={48} y={214} width={304} height={7} fill={BRAUN} />
    </svg>
  )
}
