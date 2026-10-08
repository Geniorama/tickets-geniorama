import { requireModule } from "@/lib/access/can";

// Todo lo que cuelga de /proyectos exige tener el módulo, no solo ser del equipo.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("PROYECTOS");
  return children;
}
