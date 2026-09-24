import { prisma } from "@/lib/prisma";

/**
 * ¿Puede este cliente ver el proyecto?
 *
 * La misma regla que aplicaba la página del proyecto, extraída para que la
 * usen también las Server Actions (el informe con IA): una acción que solo
 * pidiera sesión dejaría a cualquier cliente pedir el informe de un proyecto
 * ajeno adivinando su id.
 *
 *   · Privado → solo sus miembros explícitos.
 *   · Público → el proyecto es de una de las empresas del cliente.
 *
 * Solo aplica a CLIENTE; el staff sigue sus propias reglas en cada página.
 */
export async function canClientAccessProject(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { isPrivate: true, companyId: true, members: { where: { userId }, select: { userId: true } } },
  });
  if (!project) return false;

  if (project.isPrivate) return project.members.length > 0;
  if (!project.companyId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companies: { where: { id: project.companyId }, select: { id: true } } },
  });
  return (user?.companies.length ?? 0) > 0;
}
