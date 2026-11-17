"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import { borrarDemo, dataUrlABlob, leerDemo } from "@/lib/demo";
import { subirImagen } from "@/lib/imagenes";

// Si la persona armó su tarjeta en el demo de la página principal y se registró con esa dirección,
// al entrar por primera vez al panel se aplica el diseño, el logo y la foto de fondo. Solo una vez, y solo al
// negocio recién creado con esa dirección (nunca toca un negocio que ya existía).
export function DemoPendiente({ negocio, dueno }: { negocio: { id: string; slug: string }; dueno: boolean }) {
  const router = useRouter();
  const avisar = useToast();
  const hecho = useRef(false);

  useEffect(() => {
    if (!dueno || hecho.current) return;
    const d = leerDemo();
    if (!d?.slug || d.slug !== negocio.slug) return;
    hecho.current = true;
    (async () => {
      const supabase = createClient();
      try {
        let fondo: string | null = null;
        if (d.fondo) fondo = await subirImagen(supabase, negocio.id, await dataUrlABlob(d.fondo), "fondo", 1400);
        if (d.logo) {
          const ruta = `${negocio.id}/logo-${Date.now()}.webp`;
          const blob = await dataUrlABlob(d.logo);
          const { error } = await supabase.storage.from("logos").upload(ruta, blob, { contentType: blob.type || "image/webp", upsert: true });
          if (!error) {
            const url = supabase.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
            await supabase.from("negocios").update({ logo_url: url, color: d.color }).eq("id", negocio.id);
          }
        } else {
          await supabase.from("negocios").update({ color: d.color }).eq("id", negocio.id);
        }
        const { error } = await supabase
          .from("programas")
          .update({
            tipo: d.tipo,
            nombre_puntos: d.cashback ? "pesos" : "puntos",
            meta: Math.min(30, Math.max(3, d.meta)),
            premio: d.premio.trim().slice(0, 60) || "Un regalo de la casa",
            color: d.color,
            icono: d.icono,
            diseno: fondo ? "medida" : d.diseno,
            fondo_url: fondo,
            texto_claro: d.textoClaro,
          })
          .eq("negocio_id", negocio.id);
        if (error) throw error;
        borrarDemo();
        avisar("Tu tarjeta del demo quedó lista ✨");
        router.refresh();
      } catch {
        borrarDemo();
        avisar("No pudimos copiar el diseño del demo. Puedes armarlo en Tu tarjeta.", "error");
      }
    })();
  }, [dueno, negocio.id, negocio.slug, avisar, router]);

  return null;
}
