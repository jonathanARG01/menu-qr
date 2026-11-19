// Minutos para mostrar corto: "45′", "5 h 25′", "11 d 21 h".
// La usan el salón, la cocina, para llevar, reservas y la pantalla del salón,
// así un pedido viejo no aparece como "6804′".
export function duracion(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}′`;
  if (m < 1440) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}′` : ""}`;
  const h = Math.floor((m % 1440) / 60);
  return `${Math.floor(m / 1440)} d${h ? ` ${h} h` : ""}`;
}
