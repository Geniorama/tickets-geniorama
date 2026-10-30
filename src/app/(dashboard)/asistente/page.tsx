import { redirect } from "next/navigation";

/** El asistente del equipo ahora es GENIA, el mismo que usan los clientes. */
export default function AsistentePage() {
  redirect("/mi-asistente");
}
