import { requireModule } from "@/lib/access/can";

// Todo lo que cuelga de /tickets exige tener el módulo: sin esto, un colaborador de otra área entraba por la dirección aunque el menú no se lo ofreciera.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireModule("TICKETS");
  return children;
}
