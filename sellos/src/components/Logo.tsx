import { MARCA } from "@/lib/marca";

// Logo: un sello con un visto al centro (fondo carbón con borde, anillo y visto en oro).
export function Logo({ className = "", claro = false }: { className?: string; claro?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <svg viewBox="0 0 64 64" className="h-[1.6em] w-[1.6em] shrink-0" aria-hidden>
        <defs>
          <linearGradient id="logo-club-oro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f7e7b4" />
            <stop offset=".4" stopColor="#d4af37" />
            <stop offset=".75" stopColor="#a7802a" />
            <stop offset="1" stopColor="#f0d58a" />
          </linearGradient>
          <linearGradient id="logo-club-fondo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#26262a" />
            <stop offset="1" stopColor="#0d0d0f" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill="url(#logo-club-fondo)" stroke="url(#logo-club-oro)" strokeWidth="3" />
        <circle cx="32" cy="32" r="19" fill="none" stroke="url(#logo-club-oro)" strokeWidth="3.5" strokeDasharray="5 4" />
        <path d="M22.5 33l6.5 6.5 13-14" fill="none" stroke="url(#logo-club-oro)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={claro ? "text-white" : "text-tinta"}>{MARCA.toLowerCase()}</span>
    </span>
  );
}
