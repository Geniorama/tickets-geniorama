"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { parseChecklistGroups } from "@/lib/checklist";

const templateSchema = z.object({
  name:        z.string().min(1, "El nombre es requerido").max(120),
  title:       z.string().min(1, "El título es requerido").max(200),
  description: z.string().min(1, "La descripción es requerida"),
  priority:    z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  category:    z.string().optional(),
});

function parseForm(formData: FormData) {
  return templateSchema.safeParse({
    name:        formData.get("name"),
    title:       formData.get("title"),
    description: formData.get("description"),
    priority:    formData.get("priority") || "MEDIA",
    category:    formData.get("category") || undefined,
  });
}

export async function createTicketTemplate(formData: FormData): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.ticketTemplate.create({
    data: {
      name:        parsed.data.name,
      title:       parsed.data.title,
      description: parsed.data.description,
      priority:    parsed.data.priority,
      category:    parsed.data.category ?? null,
      checklist:   parseChecklistGroups(formData.get("checklist")),
      createdById: session.user.id,
    },
  });

  revalidatePath("/tickets/plantillas");
  redirect("/tickets/plantillas");
}

export async function updateTicketTemplate(id: string, formData: FormData): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.ticketTemplate.update({
    where: { id },
    data: {
      name:        parsed.data.name,
      title:       parsed.data.title,
      description: parsed.data.description,
      priority:    parsed.data.priority,
      category:    parsed.data.category ?? null,
      checklist:   parseChecklistGroups(formData.get("checklist")),
    },
  });

  revalidatePath("/tickets/plantillas");
  redirect("/tickets/plantillas");
}

export async function deleteTicketTemplate(id: string): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  await prisma.ticketTemplate.delete({ where: { id } });
  revalidatePath("/tickets/plantillas");
  return {};
}
