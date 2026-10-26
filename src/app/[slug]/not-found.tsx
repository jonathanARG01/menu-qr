import Link from "next/link";

export default function CartaNoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl">🍽️</p>
      <h1 className="mt-4 text-xl font-semibold">No encontramos esta carta</h1>
      <p className="mt-2 text-suave">Revisa la dirección o vuelve a escanear el código QR.</p>
      <Link href="/" className="mt-6 text-sm text-marca">
        Ir al inicio
      </Link>
    </main>
  );
}
