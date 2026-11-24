import { redirect } from "next/navigation";

// El tablero pasó a /gerencial (v1.145.0); se conserva el enlace antiguo.
export default function Page() {
  redirect("/gerencial");
}
