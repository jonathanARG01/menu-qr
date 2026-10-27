import Link from "next/link";

export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wider text-marca">Mesaly</p>
      <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
        La carta de tu restaurante, siempre al día.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-suave">
        Tus clientes escanean el QR de la mesa y ven la carta al instante. Tú cambias precios, platos y fotos desde el móvil en
        segundos, sin reimprimir nada.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="boton">
          Entrar al panel
        </Link>
        <Link href="/registro" className="boton-secundario">
          Crear cuenta
        </Link>
        <Link href="/la-esquina" className="boton-secundario">
          Ver carta de ejemplo
        </Link>
      </div>
    </main>
  );
}
