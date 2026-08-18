import { notFound } from "next/navigation";
import { requireCan } from "@/lib/access/can";
import { isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UserEditForm } from "@/components/admin/user-edit-form";
import { SchedulingLinksManager } from "@/components/collaborator/scheduling-links-manager";
import type { SchedulingLinkData } from "@/lib/scheduling";
import { UserAccessPanel } from "@/components/admin/user-access-panel";
import { listAccessProfiles } from "@/lib/access/profiles";
import type { AccessLevel, AppKey } from "@/generated/prisma";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: user ? `Editar: ${user.name}` : "Editar usuario" };
}

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCan("ADMIN");
  const { id } = await params;

  const [userRaw, companies, profiles] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        cargo: true, area: true, bio: true, isProjectManager: true, isSupportAgent: true,
        whatsappPhone: true,
        companies: { select: { id: true } },
        profileId: true,
        appAccess: { select: { app: true, level: true } },
        schedulingLinks: {
          select: { id: true, title: true, description: true, url: true, category: true },
          orderBy: [{ category: "asc" }, { position: "asc" }],
        },
      },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listAccessProfiles(),
  ]);

  if (!userRaw) notFound();

  const { schedulingLinks, appAccess, profileId, ...userScalar } = userRaw;

  const currentLevels: Partial<Record<AppKey, AccessLevel>> = {};
  for (const a of appAccess) currentLevels[a.app] = a.level;
  const user = {
    ...userScalar,
    companyIds: userRaw.companies.map((c) => c.id),
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar usuario</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <UserEditForm user={user} companies={companies} />
      </div>

      <div className="mt-6">
        <UserAccessPanel
          userId={userRaw.id}
          role={userRaw.role}
          profiles={profiles}
          currentProfileId={profileId}
          currentLevels={currentLevels}
        />
      </div>

      {isStaff(userRaw.role) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Links de agendamiento</h2>
          <p className="text-xs text-gray-400 mb-4">Enlaces para que los clientes agenden llamadas (Google Calendar, Calendly, etc.).</p>
          <SchedulingLinksManager userId={userRaw.id} links={schedulingLinks as SchedulingLinkData[]} />
        </div>
      )}
    </div>
  );
}
