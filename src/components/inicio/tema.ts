// Tema del sitio de venta (oscuro por defecto). Se comparte entre el script en línea de la página y el botón.
export const CLAVE_TEMA_SITIO = "platovi-tema-sitio";

// Corre antes de pintar: aplica el tema guardado y activa las animaciones de aparición (clase sitio-js).
export const SCRIPT_TEMA_SITIO = `(function(){var d=document.documentElement;try{d.dataset.temaSitio=localStorage.getItem("${CLAVE_TEMA_SITIO}")==="claro"?"claro":"oscuro"}catch(e){d.dataset.temaSitio="oscuro"}d.classList.add("sitio-js")})();`;
