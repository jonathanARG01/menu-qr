// Tema claro / oscuro de todas las pantallas (panel, admin, acceso y tarjeta del cliente).
// La preferencia se guarda en localStorage ("claro", "oscuro" o nada = igual que el sistema)
// y se aplica en <html data-tema="…"> antes de pintar, para que no parpadee.
export const CLAVE_TEMA = "club-tema";

export const SCRIPT_TEMA = `(function(){try{var p=localStorage.getItem("${CLAVE_TEMA}");var o=p==="oscuro"||(p!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.tema=o?"oscuro":"claro"}catch(e){}})()`;
