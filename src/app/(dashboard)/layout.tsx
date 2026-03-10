import { getRequiredSession } from "@/lib/auth-helpers";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

// Evitar que Next.js cachee el layout protegido en el cliente.
// Sin esto, después del logout el router cache puede servir el dashboard
// sin pasar por el middleware de autenticación.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequiredSession();

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--app-sidebar-bg)" }}>
      <Sidebar role={session.user.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar user={session.user} />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: "var(--app-content-bg)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
