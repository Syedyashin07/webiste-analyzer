export function LogoMark({ className = "h-9 w-9", onDark = false }: { className?: string; onDark?: boolean }) {
  const svg = (
    <svg viewBox="0 0 128 112" className={onDark ? "h-full w-full" : className} aria-hidden>
      <path d="M18 84h92c8 0 14 4 16 8H2c2-4 8-8 16-8z" fill="#1C1916" />
      <rect x="16" y="6" width="96" height="80" rx="16" fill="#1C1916" />
      <rect x="24" y="14" width="80" height="64" rx="8" fill="#FFFBF5" />
      <circle cx="36" cy="26" r="3.2" fill="#C4473A" />
      <circle cx="46" cy="26" r="3.2" fill="#E39A62" />
      <circle cx="56" cy="26" r="3.2" fill="#2F8F55" />
      <rect x="32" y="58" width="8" height="14" rx="1.5" fill="#E39A62" />
      <rect x="43" y="48" width="8" height="24" rx="1.5" fill="#C4621A" />
      <rect x="54" y="40" width="8" height="32" rx="1.5" fill="#BF5700" />
      <rect x="65" y="50" width="8" height="22" rx="1.5" fill="#E39A62" />
      <rect x="76" y="34" width="8" height="38" rx="1.5" fill="#BF5700" />
      <rect x="87" y="44" width="8" height="28" rx="1.5" fill="#C4621A" />
      <circle cx="78" cy="54" r="18" fill="#FFFBF5" fillOpacity="0.72" />
      <circle cx="78" cy="54" r="18" fill="none" stroke="#FFFBF5" strokeWidth="3" />
      <circle cx="78" cy="54" r="14.5" fill="none" stroke="#1C1916" strokeWidth="4.5" />
      <path d="M90 68 L108 88" stroke="#FFFBF5" strokeWidth="8" strokeLinecap="round" />
      <path d="M90 68 L106 86" stroke="#1C1916" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
  if (!onDark) return svg;
  return <span className={`inline-flex items-center justify-center rounded-xl bg-[#FFFBF5] p-1 ${className}`}>{svg}</span>;
}

export function LogoLockup({ tone = "onDark" }: { tone?: "onDark" | "onLight" }) {
  const ink = tone === "onDark" ? "text-[#F7F1E6]" : "text-slate-900";
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark onDark={tone === "onDark"} />
      <span className="leading-none">
        <span className={`block text-[13px] font-extrabold tracking-[0.12em] ${ink}`}>
          <span className="text-brand-700">W</span>EBSITE
        </span>
        <span className={`mt-1 flex items-center gap-1 text-[9px] font-semibold tracking-[0.2em] ${ink}`}>
          <span className="h-[2px] w-2.5 rounded-full bg-brand-700" />
          ANALYZER
          <span className="h-[2px] w-2.5 rounded-full bg-brand-700" />
        </span>
      </span>
    </span>
  );
}
