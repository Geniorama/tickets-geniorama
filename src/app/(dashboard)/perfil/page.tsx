import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { MyBioForm } from "@/components/collaborator/my-bio-form";
import { SchedulingLinksManager } from "@/components/collaborator/scheduling-links-manager";
import { AvatarUploader } from "@/components/collaborator/avatar-uploader";
import type { SchedulingLinkData } from "@/lib/scheduling";
import { KeyRound, CalendarClock, UserCircle } from "lucide-react";

export const metadata = { title: "Mi perfil" };

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  COLABORADOR: "Colaborador",
  CLIENTE: "Cliente",
};

export default async function PerfilPage() {
  const session = await getRequiredSession();
  const staff = isStaff(session.user.role);

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      avatarUrl: true,
      bio: true,
      isProjectManager: true,
      isSupportAgent: true,
      schedulingLinks: {
        select: { id: true, title: true, description: true, url: true, category: true },
        orderBy: [{ category: "asc" }, { position: "asc" }],
      },
    },
  });

  const designations: string[] = [];
  if (me?.isProjectManager) designations.push("Gestor de proyectos");
  if (me?.isSupportAgent) designations.push("Agente de soporte");

  const cardClass = "bg-white rounded-xl border border-gray-200 p-6";

  const passwordCard = (
    <div className={cardClass}>
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-800">Cambiar contraseña</h2>
      </div>
      <ChangePasswordForm />
    </div>
  );

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      {/* Cabecera: avatar + identidad */}
      <div className={`${cardClass} mb-6 flex flex-col sm:flex-row sm:items-center gap-6`}>
        <AvatarUploader currentUrl={me?.avatarUrl ?? null} name={session.user.name ?? ""} />
        <div className="sm:border-l sm:border-gray-200 sm:pl-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 flex-1">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Nombre</p>
            <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Email</p>
            <p className="text-sm font-medium text-gray-900 break-all">{session.user.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Rol</p>
            <p className="text-sm font-medium text-gray-900">{ROLE_LABELS[session.user.role] ?? session.user.role}</p>
          </div>
        </div>
      </div>

      {staff ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Perfil público */}
            <div className={cardClass}>
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="w-4 h-4 text-gray-500" />
                <h2 className="text-base font-semibold text-gray-800">Perfil público</h2>
              </div>
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Designaciones</p>
                {designations.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {designations.map((d) => (
                      <span key={d} className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium">
                        {d}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Sin designaciones. Un administrador puede marcarte como Gestor de proyectos o Agente de soporte para que aparezcas ante los clientes.
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-1">Biografía</p>
              <MyBioForm initialBio={me?.bio ?? ""} />
            </div>

            {passwordCard}
          </div>

          {/* Links de agendamiento — ancho completo */}
          <div className={`${cardClass} mt-6`}>
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-800">Mis links de agendamiento</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Enlaces para que los clientes agenden llamadas contigo (Google Calendar, Calendly, etc.).</p>
            <SchedulingLinksManager userId={session.user.id} links={(me?.schedulingLinks ?? []) as SchedulingLinkData[]} />
          </div>
        </>
      ) : (
        <div className="max-w-xl">{passwordCard}</div>
      )}
    </div>
  );
}
