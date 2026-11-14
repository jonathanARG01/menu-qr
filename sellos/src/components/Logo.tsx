import { MARCA } from "@/lib/marca";

// Logo de Sellito: un sello con un ticket al centro.
export function Logo({ className = "", claro = false }: { className?: string; claro?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <svg viewBox="0 0 64 64" className="h-[1.6em] w-[1.6em] shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#c43d22" />
        <circle cx="32" cy="32" r="19" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="5 4" />
        <path d="M22.5 33l6.5 6.5 13-14" fill="none" stroke="#ffcf5c" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={claro ? "text-white" : "text-tinta"}>{MARCA.toLowerCase()}</span>
    </span>
  );
}
