import Link from "next/link";

export function AuthShell({ titulo, children, pie }: { titulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-sm font-semibold uppercase tracking-wider text-marca">
          Menús QR
        </Link>
        <div className="tarjeta p-6 shadow-sm">
          <h1 className="mb-5 text-xl font-semibold">{titulo}</h1>
          {children}
        </div>
        {pie && <div className="mt-5 text-center text-sm text-suave">{pie}</div>}
      </div>
    </main>
  );
}

export function Aviso({ tipo = "error", children }: { tipo?: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${tipo === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
    >
      {children}
    </p>
  );
}
