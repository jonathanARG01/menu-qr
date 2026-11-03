import Link from "next/link";

export const metadata = { title: "Novedades · Platovi" };

type Novedad = { titulo: string; texto: string; donde?: { href: string; texto: string } };

// Lo nuevo en Platovi, lo más reciente primero. Cada entrada dice qué cambió y dónde encontrarlo.
const NOVEDADES: { fecha: string; titulo: string; items: Novedad[] }[] = [
  {
    fecha: "Noviembre 2026",
    titulo: "Íconos para tus platos",
    items: [
      {
        titulo: "Elige un ícono para cada plato sin foto",
        texto:
          "Al editar un plato toca “Elegir ícono”: hay 135 para elegir (bebidas, cervezas, tragos, jugos, postres como flan, leche asada o jalea, carnes, mariscos, ensaladas y más) y un buscador. Se ve en la carta en todos los diseños. Si después subes una foto, se usa la foto.",
        donde: { href: "/panel", texto: "Carta" },
      },
      {
        titulo: "Borrar una categoría sin perder sus platos",
        texto:
          "En el menú ⋯ de la categoría, “Borrar categoría” ahora te pregunta qué hacer con sus platos: pasarlos a otra categoría o borrarlos también.",
        donde: { href: "/panel", texto: "Carta" },
      },
    ],
  },
  {
    fecha: "Noviembre 2026",
    titulo: "Platovi Loyalty",
    items: [
      {
        titulo: "Tarjeta de sellos en el celular",
        texto:
          "Tus clientes se unen con un QR, guardan la tarjeta en el celular (o en Google Wallet) y suman un sello escaneando el QR de la precuenta. Al completarla ganan el premio que elijas y el mesero lo canjea. Reemplaza al antiguo “premio cada tantas visitas”. Es un complemento que se contrata aparte del plan.",
        donde: { href: "/panel/sellos", texto: "Loyalty Cards" },
      },
      {
        titulo: "12 diseños para tu tarjeta",
        texto:
          "Elige entre Clásica, Boleto, De época, Neón, Pasaporte, Editorial, Aurora, Pizarra, Camino, Círculo, Pop y Premium. Todos usan tu logo, tu color y el dibujo de los sellos que elijas.",
        donde: { href: "/panel/sellos", texto: "Loyalty Cards" },
      },
    ],
  },
  {
    fecha: "Noviembre 2026",
    titulo: "Control y orden para el dueño",
    items: [
      {
        titulo: "PIN de encargado",
        texto:
          "Cada persona del equipo puede tener un PIN. Si lo activas, un mesero necesita el PIN de un encargado para anular una mesa o quitar algo que ya está en cocina. Todo queda registrado: quién lo pidió, quién autorizó y por qué.",
        donde: { href: "/panel/equipo#pin", texto: "Equipo" },
      },
      {
        titulo: "Descuentos y cortesías con motivo",
        texto:
          "En la mesa, el botón % aplica un porcentaje, un monto o una cortesía a toda la cuenta o a platos elegidos. Siempre con motivo, y un mesero necesita el PIN de un encargado.",
        donde: { href: "/panel/reportes/autorizaciones", texto: "Reportes → Autorizaciones" },
      },
      {
        titulo: "Ranking de productos",
        texto:
          "Lo más vendido por monto o unidades, por canal y categoría, comparado con el período anterior, las horas de más venta y los platos que casi no salen.",
        donde: { href: "/panel/reportes/productos", texto: "Reportes → Productos" },
      },
      {
        titulo: "Gastos por categoría, retiros y corte parcial",
        texto:
          "Los gastos llevan categoría y proveedor, y puedes anotar retiros de efectivo a la caja fuerte. “Corte parcial” guarda e imprime cómo va el turno sin cerrarlo. El reporte mensual se exporta a Excel para el contador.",
        donde: { href: "/panel/caja", texto: "Caja" },
      },
      {
        titulo: "Precuenta con tu marca",
        texto: "Tu logo, un mensaje de agradecimiento, un QR para dejar la reseña en Google y tus datos al pie.",
        donde: { href: "/panel/personalizar", texto: "Personalizar" },
      },
      {
        titulo: "Importar la carta desde Excel",
        texto:
          "Pega lo que copiaste de Excel o Google Sheets, o sube un CSV (también el que exportan otros sistemas). Ves la vista previa antes de guardar.",
        donde: { href: "/panel", texto: "Carta" },
      },
      {
        titulo: "Repetir el último pedido",
        texto: "En Para llevar, al escribir el teléfono de un cliente ves sus últimos pedidos y los repites con un toque.",
        donde: { href: "/panel/llevar", texto: "Para llevar" },
      },
      {
        titulo: "Botón a tu tienda online",
        texto: "Si vendes en Shopify, Jumpseller u otra tienda, pon el enlace y sale como botón al final de la carta.",
        donde: { href: "/panel/marca", texto: "Marca" },
      },
    ],
  },
  {
    fecha: "Octubre 2026",
    titulo: "Mejoras pedidas por restaurantes",
    items: [
      {
        titulo: "Cambiar de mesa, juntar mesas y pasar platos",
        texto:
          "Desde la mesa: “Cambiar de mesa”, “Juntar con otra” (unir mesas pegadas con una sola cuenta, o que unos se pasen a la mesa de los otros) y ⇄ en cada plato para moverlo a otra cuenta. La mesa unida se pone al lado en el plano y se puede arrastrar (si no cabe, una cuerda verde las une); al cobrar vuelve a su lugar.",
        donde: { href: "/panel/salon", texto: "Salón" },
      },
      {
        titulo: "Opciones por plato",
        texto:
          "Punto de la carne, acompañamiento, tamaño o extras, con precio adicional. El cliente y el mesero las eligen al pedir.",
        donde: { href: "/panel", texto: "Carta" },
      },
      {
        titulo: "Tiempos: dejar para después y marchar",
        texto:
          "Al tomar la comanda marca “Después” en los fondos; quedan en espera hasta que tocas “Marchar”. El cliente también puede dejar platos “Para después” desde su celular y pedirlos cuando quiera desde Mi mesa.",
      },
      {
        titulo: "La comanda no se pierde",
        texto: "Si se corta internet, la comanda queda guardada en el teléfono, se reintenta sola y nunca sale repetida.",
      },
      {
        titulo: "Mesas a cargo de cada mesero",
        texto: "Asigna mesas a cada mesero. Su foto o sus iniciales aparecen en la mesa, y avisa si atiendes una mesa de otro.",
        donde: { href: "/panel/equipo", texto: "Equipo" },
      },
      {
        titulo: "Foto, emoji o iniciales para cada persona",
        texto: "Cada uno puede elegir su imagen tocando su círculo en el menú. Se ve en el plano y en las comandas.",
      },
      {
        titulo: "Miniaturas en cocina y avisos",
        texto: "Las comandas y los avisos muestran la foto de cada plato con su cantidad (2×). Se apaga en Personalizar.",
        donde: { href: "/panel/personalizar", texto: "Personalizar" },
      },
      {
        titulo: "Vuelto al cobrar en efectivo",
        texto: "Anota con cuánto paga el cliente y Platovi calcula el vuelto.",
      },
      {
        titulo: "Gastos en caja",
        texto: "Registra pagos a proveedores o compras con comprobante impreso; se descuentan del efectivo esperado.",
        donde: { href: "/panel/caja", texto: "Caja" },
      },
      {
        titulo: "Vista para el repartidor",
        texto: "En Para llevar, “Repartidor” comparte un enlace con la dirección, el teléfono y el botón “Entregado”.",
        donde: { href: "/panel/llevar", texto: "Para llevar" },
      },
      {
        titulo: "Total en otra moneda",
        texto: "Muestra el total aproximado en dólares, euros u otra moneda para turistas.",
        donde: { href: "/panel/personalizar", texto: "Personalizar" },
      },
      {
        titulo: "Mismo número de mesa en distintos pisos",
        texto: "Ya puedes tener una mesa 1 en la terraza y otra en el salón; cada una con su propio QR.",
      },
      {
        titulo: "Plan B si falla Mercado Pago",
        texto: "Si el pago en línea no funciona, el cliente puede elegir pagar al retirar y el pedido igual llega.",
      },
      {
        titulo: "Precio distinto para llevar",
        texto: "Cada plato puede tener un precio para llevar o delivery.",
      },
      {
        titulo: "Buscar un plato en el salón y hora de cada pedido",
        texto: "Busca un plato y se marcan las mesas que lo pidieron. Cada pedido muestra a qué hora salió.",
      },
      {
        titulo: "El panel como app",
        texto: "Instálalo en el teléfono o la tablet con “Instalar app” en el menú (en iPhone: Compartir → Agregar a inicio).",
      },
      {
        titulo: "Tus datos",
        texto: "Descarga todos los datos del restaurante o elimina la cuenta cuando quieras, como pide la Ley 21.719.",
        donde: { href: "/panel/personalizar", texto: "Personalizar" },
      },
    ],
  },
];

export default function Novedades() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novedades</h1>
        <p className="mt-1 text-sm text-suave">Lo nuevo en Platovi. ¿Echas algo de menos? Escríbenos desde “Ayuda” en el menú.</p>
      </div>
      {NOVEDADES.map((n) => (
        <section key={n.fecha} className="tarjeta p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-marca">{n.fecha}</p>
          <h2 className="mt-0.5 text-lg font-semibold">{n.titulo}</h2>
          <ul className="mt-4 divide-y divide-borde">
            {n.items.map((i) => (
              <li key={i.titulo} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.titulo}</p>
                  <p className="text-sm text-suave">{i.texto}</p>
                </div>
                {i.donde && (
                  <Link href={i.donde.href} className="shrink-0 text-sm font-semibold text-marca hover:underline">
                    {i.donde.texto} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
