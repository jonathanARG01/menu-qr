// Envíos que no se pueden perder (comandas): si falla la conexión se reintenta solo, con esperas crecientes.
// Las filas llevan su id generado en el teléfono, así un reintento nunca duplica lo que ya llegó.

export function esErrorDeRed(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const texto = String((error as { message?: string } | null)?.message ?? error ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|aborted/i.test(texto);
}

export async function conReintentos<T extends { error: unknown }>(intento: () => PromiseLike<T>, veces = 3): Promise<T> {
  let r = await intento();
  for (let i = 0; r.error && esErrorDeRed(r.error) && i < veces; i++) {
    await new Promise((listo) => setTimeout(listo, 1000 * 2 ** i));
    r = await intento();
  }
  return r;
}

export const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
      );
