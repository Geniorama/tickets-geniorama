import { requireModule } from "@/lib/access/can";

// Los reportes de tickets son parte del módulo de Tickets.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("TICKETS");
  return children;
}
