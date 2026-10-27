import type { Plato, Promo } from "./types";

// Promos por horario. La misma regla que usa la base de datos (promo_vigente y precio_vigente en 0009),
// así el precio que ve el cliente es el que se cobra.

export const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Día de la semana y minutos desde la medianoche en la zona del restaurante.
export function momentoLocal(zona: string, ahora = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(ahora);
    const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "0";
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday"));
    return { dia, minutos: Number(v("hour")) * 60 + Number(v("minute")) + Number(v("second")) / 60 };
  } catch {
    return { dia: ahora.getDay(), minutos: ahora.getHours() * 60 + ahora.getMinutes() };
  }
}

const aMinutos = (hora: string) => {
  const [h, m = "0", s = "0"] = hora.split(":");
  return Number(h) * 60 + Number(m) + Number(s) / 60;
};

export function promoVigente(p: Promo, zona: string, ahora = new Date()) {
  if (!p.activa) return false;
  const { dia, minutos } = momentoLocal(zona, ahora);
  const desde = aMinutos(p.desde);
  const hasta = aMinutos(p.hasta);
  const todos = !p.dias?.length;
  const hoy = todos || p.dias.includes(dia);
  if (desde <= hasta) return hoy && minutos >= desde && minutos < hasta;
  const ayer = todos || p.dias.includes((dia + 6) % 7);
  return (hoy && minutos >= desde) || (ayer && minutos < hasta);
}

export const aplicaA = (p: Promo, plato: Pick<Plato, "id" | "categoria_id">) =>
  (!p.categorias?.length && !p.platos?.length) || p.categorias?.includes(plato.categoria_id) || p.platos?.includes(plato.id);

// Precio con el mejor descuento vigente (redondeado a pesos si el precio no tiene centavos).
export function precioConPromo(plato: Plato, vigentes: Promo[]) {
  const descuento = Math.max(0, ...vigentes.filter((p) => p.descuento > 0 && aplicaA(p, plato)).map((p) => p.descuento));
  if (!descuento) return Number(plato.precio);
  const precio = Number(plato.precio);
  const nuevo = (precio * (100 - descuento)) / 100;
  return Number.isInteger(precio) ? Math.round(nuevo) : Math.round(nuevo * 100) / 100;
}

export const horaPromo = (hora: string) => hora.slice(0, 5);

export function describirDias(dias: number[]) {
  if (!dias?.length || dias.length === 7) return "Todos los días";
  const orden = [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const lunVie = [1, 2, 3, 4, 5];
  if (orden.length === 5 && lunVie.every((d) => orden.includes(d))) return "De lunes a viernes";
  if (orden.length === 2 && orden.includes(6) && orden.includes(0)) return "Sábados y domingos";
  return orden.map((d) => DIAS[d]).join(", ");
}
