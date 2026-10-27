import { requerirSeccion } from "@/lib/panel";
import { Caja } from "./Caja";

export const dynamic = "force-dynamic";

export default async function PanelCaja() {
  const { restaurante, admin, user } = await requerirSeccion("caja");
  return <Caja restaurante={restaurante} admin={admin} usuario={{ id: user.id, email: user.email ?? "" }} />;
}
