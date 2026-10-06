"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateLogo, uploadLogo, deleteFile } from "@/lib/s3";
import { datosEmpresa, validarEmpresa } from "@/lib/admin/records";

const companySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  taxId: z.string().optional(),
  type: z.enum(["AGENCIA", "EMPRESA"]).default("EMPRESA"),
  parentId: z.string().optional(),
});

export async function createCompany(formData: FormData) {
  await requireCan("ADMIN");

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    taxId: formData.get("taxId") || undefined,
    type: formData.get("type") || "EMPRESA",
    parentId: formData.get("parentId") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Las reglas (agencias, duplicados) viven en lib/admin/records: el asistente
  // (MCP) aplica las mismas
  const invalido = await validarEmpresa(parsed.data);
  if (invalido) return { error: invalido };

  const company = await prisma.company.create({ data: datosEmpresa(parsed.data) });

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
  await requireCan("ADMIN");

  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    taxId: formData.get("taxId") || undefined,
    type: formData.get("type") || "EMPRESA",
    parentId: formData.get("parentId") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const invalido = await validarEmpresa(parsed.data, companyId);
  if (invalido) return { error: invalido };

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
      ...datosEmpresa(parsed.data),
      ...(logoData ? logoData : {}),
      ...(removeLogo ? { logoUrl: null, logoStoragePath: null } : {}),
    },
  });

  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}/edit`);
  return { success: true };
}

export async function toggleCompanyActive(companyId: string, isActive: boolean) {
  await requireCan("ADMIN");

  await prisma.company.update({ where: { id: companyId }, data: { isActive } });

  revalidatePath("/admin/companies");
  return { success: true };
}

export async function deleteCompany(companyId: string) {
  await requireCan("ADMIN");

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
