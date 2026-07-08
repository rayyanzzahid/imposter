export function Logo({ size = 64 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* faded "double-hit" ghost print behind the main stamp */}
      <svg className="logo-ghost absolute inset-0" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="27" cy="27" r="14" stroke="#C0392B" strokeWidth="4" fill="none" />
        <line x1="37" y1="37" x2="48" y2="48" stroke="#C0392B" strokeWidth="5" strokeLinecap="round" />
      </svg>

      <svg className="logo-mark absolute inset-0" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Imposter">
        <defs>
          <clipPath id="lens-clip">
            <circle cx="27" cy="27" r="12" />
          </clipPath>
        </defs>
        <rect width="64" height="64" rx="14" fill="#1D1E25" />
        <circle cx="27" cy="27" r="14" stroke="#C9A24B" strokeWidth="4" fill="none" />
        <line x1="37" y1="37" x2="48" y2="48" stroke="#C9A24B" strokeWidth="5" strokeLinecap="round" />
        <text x="27" y="33" fontFamily="var(--font-mono)" fontSize="16" fill="#C0392B" textAnchor="middle" fontWeight="bold">
          ?
        </text>
        <g clipPath="url(#lens-clip)">
          <rect className="logo-glint" x="-20" y="10" width="14" height="34" fill="rgba(237,234,225,0.5)" />
        </g>
      </svg>
    </div>
  )
}