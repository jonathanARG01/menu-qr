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
    // Fecha local en formato 2026-12-26 (en-CA escribe año-mes-día).
    const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
    return { dia, fecha, minutos: Number(v("hour")) * 60 + Number(v("minute")) + Number(v("second")) / 60 };
  } catch {
    const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    return { dia: ahora.getDay(), fecha, minutos: ahora.getHours() * 60 + ahora.getMinutes() };
  }
}

// El día anterior a una fecha "2026-12-26" → "2026-12-25" (para las promos que cruzan la medianoche).
export function diaAnterior(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d - 1));
  return f.toISOString().slice(0, 10);
}

// ¿La fecha entra en las fechas puntuales y en el rango de la promo? (migración 0041; sin datos, siempre).
export function fechaPermitida(p: Pick<Promo, "fechas" | "fecha_desde" | "fecha_hasta">, fecha: string) {
  if (p.fechas?.length && !p.fechas.includes(fecha)) return false;
  if (p.fecha_desde && fecha < p.fecha_desde) return false;
  if (p.fecha_hasta && fecha > p.fecha_hasta) return false;
  return true;
}

const aMinutos = (hora: string) => {
  const [h, m = "0", s = "0"] = hora.split(":");
  return Number(h) * 60 + Number(m) + Number(s) / 60;
};

export function promoVigente(p: Promo, zona: string, ahora = new Date()) {
  if (!p.activa) return false;
  const { dia, fecha, minutos } = momentoLocal(zona, ahora);
  const desde = aMinutos(p.desde);
  const hasta = aMinutos(p.hasta);
  const todos = !p.dias?.length;
  const hoy = (todos || p.dias.includes(dia)) && fechaPermitida(p, fecha);
  if (desde <= hasta) return hoy && minutos >= desde && minutos < hasta;
  const ayer = (todos || p.dias.includes((dia + 6) % 7)) && fechaPermitida(p, diaAnterior(fecha));
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

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "2026-12-26" → "26 dic"; con año si no es el actual.
export function fechaPromo(fecha: string, conAnio = false) {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1]}${conAnio || a !== new Date().getFullYear() ? ` ${a}` : ""}`;
}

// "Solo 24 dic y 31 dic", "Del 1 dic al 15 ene", "Desde el 1 dic"… o vacío si la promo no tiene fechas.
export function describirFechas(p: Pick<Promo, "fechas" | "fecha_desde" | "fecha_hasta">) {
  if (p.fechas?.length) {
    const orden = [...p.fechas].sort();
    const lista = orden.slice(0, 4).map((f) => fechaPromo(f));
    const resto = orden.length > 4 ? ` y ${orden.length - 4} más` : "";
    return `Solo ${lista.length > 1 && !resto ? `${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}` : lista.join(", ")}${resto}`;
  }
  if (p.fecha_desde && p.fecha_hasta) return `Del ${fechaPromo(p.fecha_desde)} al ${fechaPromo(p.fecha_hasta)}`;
  if (p.fecha_desde) return `Desde el ${fechaPromo(p.fecha_desde)}`;
  if (p.fecha_hasta) return `Hasta el ${fechaPromo(p.fecha_hasta)}`;
  return "";
}

// Ya pasó su última fecha: no se va a volver a activar.
export function promoVencida(p: Pick<Promo, "fechas" | "fecha_hasta">, zona: string, ahora = new Date()) {
  const { fecha } = momentoLocal(zona, ahora);
  const ultima = p.fechas?.length ? [...p.fechas].sort().at(-1)! : p.fecha_hasta;
  return !!ultima && ultima < diaAnterior(fecha);
}
