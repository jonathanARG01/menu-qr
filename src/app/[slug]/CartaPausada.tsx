// Lo que ve el cliente al escanear el QR de una carta pausada. No dice por qué: solo que la pida en el local.
export function CartaPausada({
  nombre,
  logo_url,
  color_primario,
}: {
  nombre: string;
  logo_url: string | null;
  color_primario: string;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center">
      {logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover shadow-sm" />
      ) : (
        <span
          className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold text-white shadow-sm"
          style={{ background: color_primario }}
        >
          {nombre.charAt(0).toUpperCase()}
        </span>
      )}
      <h1 className="mt-5 text-2xl font-semibold">{nombre}</h1>
      <p className="mt-2 max-w-xs text-suave">
        Estamos actualizando nuestra carta digital. Mientras tanto, pídela a nuestro equipo: con gusto te la mostramos. 🙂
      </p>
      <p className="mt-2 max-w-xs text-sm text-suave">We are updating our digital menu. Please ask our staff for the menu.</p>
    </main>
  );
}
