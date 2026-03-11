"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { validateLogo, uploadLogo, deleteFile } from "@/lib/s3";

const companySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  taxId: z.string().optional(),
  type: z.enum(["AGENCIA", "EMPRESA"]).default("EMPRESA"),
  parentId: z.string().optional(),
});

export async function createCompany(formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    taxId: formData.get("taxId") || undefined,
    type: formData.get("type") || "EMPRESA",
    parentId: formData.get("parentId") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Las agencias no pueden tener empresa padre
  if (parsed.data.type === "AGENCIA" && parsed.data.parentId) {
    return { error: "Una agencia no puede pertenecer a otra empresa" };
  }

  // Validar que el padre exista y sea una agencia
  if (parsed.data.type === "EMPRESA" && parsed.data.parentId) {
    const parent = await prisma.company.findUnique({
      where: { id: parsed.data.parentId },
      select: { type: true },
    });
    if (!parent) return { error: "La agencia seleccionada no existe" };
    if (parent.type !== "AGENCIA") return { error: "La empresa padre debe ser de tipo Agencia" };
  }

  const existing = await prisma.company.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (existing) return { error: "Ya existe una empresa con ese nombre" };

  const company = await prisma.company.create({
    data: {
      name: parsed.data.name,
      taxId: parsed.data.taxId,
      type: parsed.data.type,
      parentId: parsed.data.type === "EMPRESA" ? (parsed.data.parentId ?? null) : null,
    },
  });

  // Subir logo si se proporcionó
  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    const err = validateLogo(logoFile);
    if (err) return { error: err };
    try {
      const { storagePath, fileUrl } = await uploadLogo(logoFile, company.id);
      await prisma.company.update({
        where: { id: company.id },
        data: { logoUrl: fileUrl, logoStoragePath: storagePath },
      });
    } catch {
      // Logo falla silenciosamente — la empresa ya fue creada
    }
  }

  revalidatePath("/admin/companies");
  return { success: true };
}

export async function updateCompany(companyId: string, formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    taxId: formData.get("taxId") || undefined,
    type: formData.get("type") || "EMPRESA",
    parentId: formData.get("parentId") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.type === "AGENCIA" && parsed.data.parentId) {
    return { error: "Una agencia no puede pertenecer a otra empresa" };
  }

  // Si cambia a EMPRESA, validar que no tenga subempresas activas
  if (parsed.data.type === "EMPRESA") {
    const subCount = await prisma.company.count({
      where: { parentId: companyId },
    });
    if (subCount > 0) {
      return { error: "No puedes cambiar a Empresa porque tiene subempresas asociadas" };
    }
  }

  // Validar que el padre exista y sea una agencia
  if (parsed.data.type === "EMPRESA" && parsed.data.parentId) {
    if (parsed.data.parentId === companyId) {
      return { error: "Una empresa no puede ser su propia agencia" };
    }
    const parent = await prisma.company.findUnique({
      where: { id: parsed.data.parentId },
      select: { type: true },
    });
    if (!parent) return { error: "La agencia seleccionada no existe" };
    if (parent.type !== "AGENCIA") return { error: "La empresa padre debe ser de tipo Agencia" };
  }

  const duplicate = await prisma.company.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" }, NOT: { id: companyId } },
  });
  if (duplicate) return { error: "Ya existe una empresa con ese nombre" };

  const logoFile = formData.get("logo") as File | null;
  let logoData: { logoUrl: string; logoStoragePath: string } | undefined;

  if (logoFile && logoFile.size > 0) {
    const err = validateLogo(logoFile);
    if (err) return { error: err };
    try {
      const current = await prisma.company.findUnique({
        where: { id: companyId },
        select: { logoStoragePath: true },
      });
      if (current?.logoStoragePath) {
        await deleteFile(current.logoStoragePath).catch(() => {});
      }
      const { storagePath, fileUrl } = await uploadLogo(logoFile, companyId);
      logoData = { logoUrl: fileUrl, logoStoragePath: storagePath };
    } catch {
      return { error: "Error al subir el logo. Intenta de nuevo." };
    }
  }

  const removeLogo = formData.get("removeLogo") === "1";
  if (removeLogo) {
    const current = await prisma.company.findUnique({
      where: { id: companyId },
      select: { logoStoragePath: true },
    });
    if (current?.logoStoragePath) {
      await deleteFile(current.logoStoragePath).catch(() => {});
    }
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: parsed.data.name,
      taxId: parsed.data.taxId ?? null,
      type: parsed.data.type,
      parentId: parsed.data.type === "EMPRESA" ? (parsed.data.parentId ?? null) : null,
      ...(logoData ? logoData : {}),
      ...(removeLogo ? { logoUrl: null, logoStoragePath: null } : {}),
    },
  });

  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}/edit`);
  return { success: true };
}

export async function toggleCompanyActive(companyId: string, isActive: boolean) {
  await requireRole(["ADMINISTRADOR"]);

  await prisma.company.update({ where: { id: companyId }, data: { isActive } });

  revalidatePath("/admin/companies");
  return { success: true };
}

export async function deleteCompany(companyId: string) {
  await requireRole(["ADMINISTRADOR"]);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      logoStoragePath: true,
      _count: {
        select: {
          subCompanies: true,
          users: true,
          plans: true,
          projects: true,
        },
      },
    },
  });

  if (!company) return { error: "Empresa no encontrada." };

  const { subCompanies, users, plans, projects } = company._count;

  if (subCompanies > 0) {
    return { error: "No se puede eliminar la agencia porque tiene subempresas asociadas." };
  }
  if (users > 0) {
    return { error: "No se puede eliminar la empresa porque tiene usuarios asociados." };
  }
  if (plans > 0) {
    return { error: "No se puede eliminar la empresa porque tiene planes asociados." };
  }
  if (projects > 0) {
    return { error: "No se puede eliminar la empresa porque tiene proyectos asociados." };
  }

  // Delete logo from storage if exists
  if (company.logoStoragePath) {
    await deleteFile(company.logoStoragePath).catch(() => {});
  }

  await prisma.company.delete({ where: { id: companyId } });

  revalidatePath("/admin/companies");
  redirect("/admin/companies");
}
