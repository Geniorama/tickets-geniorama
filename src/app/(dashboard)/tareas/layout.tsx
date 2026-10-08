import { requireModule } from "@/lib/access/can";

// Las tareas son parte del módulo de Proyectos.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("PROYECTOS");
  return children;
}
