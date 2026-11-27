interface UbtVectorLogoProps {
  className?: string;
}

/**
 * Logotipo vetorial SVG da UBT Serviços — renderização 100% nítida e sem
 * arestas serrilhadas ou halos brancos em fundos escuros (#09090B / #000000).
 */
export default function UbtVectorLogo({ className = "h-10 w-auto" }: UbtVectorLogoProps) {
  return (
    <svg
      viewBox="0 0 260 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="UBT Serviços"
      className={className}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="ubtWaveGrad" x1="88" y1="14" x2="246" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E676" />
          <stop offset="55%" stopColor="#16A34A" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
        <linearGradient id="ubtLetterGrad" x1="16" y1="22" x2="16" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>

      {/* Arco verde característico sobre B e T */}
      <path
        d="M95 54C108 26 154 11 245 27C186 19 135 28 106 58L95 54Z"
        fill="url(#ubtWaveGrad)"
      />

      {/* Letra U */}
      <path
        d="M18 26H35V55C35 64 41 69 49.5 69C58 69 64 64 64 55V26H81V55.5C81 73.5 68 83 49.5 83C31 83 18 73.5 18 55.5V26Z"
        fill="url(#ubtLetterGrad)"
      />
      {/* Detalhe verde na curva interna do U */}
      <path
        d="M24 62C33 70 48 72 62 63C55 72 41 76 28 69L24 62Z"
        fill="#00E676"
      />
      <path
        d="M64 26H79C75 40 70 50 64 57V26Z"
        fill="#16A34A"
      />

      {/* Letra B */}
      <path
        d="M99 26H134C149 26 158 33 158 43.5C158 50.5 153.5 55.5 146 57.5C155 59.5 161 65.5 161 73.5C161 84.5 150.5 83 135 83H99V26ZM116 49H131.5C137.5 49 141 46.5 141 42.5C141 38.5 137.5 36.5 131.5 36.5H116V49ZM116 71.5H133.5C140 71.5 144 69 144 64.5C144 60 140 57.5 133.5 57.5H116V71.5Z"
        fill="url(#ubtLetterGrad)"
      />
      {/* Detalhe verde na curva inferior do B */}
      <path
        d="M142 54C155 56 162 63 161 73C160 80 152 83 139 83C147 77 148 64 142 54Z"
        fill="#16A34A"
      />

      {/* Letra T */}
      <path
        d="M168 26H236V39.5H210.5V83H193.5V39.5H168V26Z"
        fill="url(#ubtLetterGrad)"
      />
      {/* Detalhe verde diagonal no T */}
      <path
        d="M231 26C215 34 203 48 193.5 68V39.5H210.5L231 26Z"
        fill="#00E676"
      />
    </svg>
  );
}
