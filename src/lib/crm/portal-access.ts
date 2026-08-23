/**
 * Convertir un contacto en usuario del portal.
 *
 * Es el puente entre las dos formas que tiene una persona de existir aquí: un
 * `Contact` es alguien de la agenda comercial y no entra a ningún sitio; un
 * `User` sí. En vez de duplicar a la persona, se enlazan — por eso `Contact`
 * lleva `userId` desde el primer día.
 *
 * Vive fuera de la Server Action a propósito. Esto crea credenciales de acceso,
 * que es lo más delicado que hace el CRM, y una función normal se puede probar
 * de verdad; una Server Action arranca pidiendo sesión y no.
 *
 * Dos límites que impiden que sea una puerta trasera para fabricar cuentas:
 *
 *   · El usuario nace **siempre CLIENTE** y **siempre atado a la empresa de la
 *     cuenta**. No se puede elegir rol ni empresa, así que llevar el CRM no
 *     permite crearse un colaborador ni un administrador.
 *   · Si ya existe un usuario con ese correo **no se crea otro**: se enlaza con
 *     quien ya está y se le suma la empresa. Duplicar personas por correo es
 *     como se corrompe una base de clientes.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/crm/contact-name";

export type GrantResult =
  | { ok: false; error: string }
  | { ok: true; userId: string; contactName: string; email: string; reutilizado: boolean };

export async function grantPortalAccess(
  actorId: string,
  contactId: string,
  accountId: string,
): Promise<GrantResult> {
  // Acotado a la cuenta: un id suelto no puede dar acceso desde otra empresa.
  const contacto = await prisma.contact.findFirst({
    where: { id: contactId, companyId: accountId },
    select: {
      id: true, firstName: true, lastName: true, email: true, userId: true,
      company: { select: { id: true } },
    },
  });
  if (!contacto) return { ok: false, error: "Contacto no encontrado" };
  if (contacto.userId) return { ok: false, error: "Este contacto ya tiene acceso al portal" };

  const email = contacto.email?.trim().toLowerCase();
  if (!email) return { ok: false, error: "Añade primero un correo al contacto" };

  const existente = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, contactProfile: { select: { id: true } } },
  });

  // El enlace es uno a uno: si ese usuario ya es el reflejo de otro contacto,
  // enlazarlo aquí dejaría a dos personas del CRM apuntando a la misma cuenta.
  if (existente?.contactProfile) {
    return { ok: false, error: "Ese correo ya está enlazado a otro contacto" };
  }

  // Alguien del equipo no es el contacto-cliente de nadie. Enlazarlo no le daría
  // más poder —ya lo tiene—, pero sí ataría su cuenta a una empresa desde el
  // CRM, y esa es una decisión de Administración, no de quien lleva las ventas.
  if (existente && existente.role !== "CLIENTE") {
    return { ok: false, error: "Ese correo es de alguien del equipo, no de un cliente" };
  }

  let userId: string;
  let reutilizado = false;

  if (existente) {
    await prisma.user.update({
      where: { id: existente.id },
      data: { companies: { connect: { id: contacto.company.id } } },
    });
    userId = existente.id;
    reutilizado = true;
  } else {
    // Una clave imposible de adivinar y que nadie conoce: la real la establece
    // la persona desde el enlace de la invitación.
    const provisional = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    const creado = await prisma.user.create({
      data: {
        name: fullName(contacto),
        email,
        passwordHash: provisional,
        role: "CLIENTE",
        companies: { connect: { id: contacto.company.id } },
      },
      select: { id: true },
    });
    userId = creado.id;
  }

  await prisma.contact.update({ where: { id: contacto.id }, data: { userId } });

  // Queda en el historial de la cuenta: dar acceso es un hecho comercial, y
  // dentro de seis meses alguien preguntará cuándo se hizo y quién lo hizo.
  await prisma.crmActivity.create({
    data: {
      companyId: accountId,
      contactId: contacto.id,
      type: "NOTA",
      summary: reutilizado
        ? `${fullName(contacto)} se enlazó con su usuario existente`
        : `${fullName(contacto)} recibió acceso al portal`,
      occurredAt: new Date(),
      createdById: actorId,
    },
  });

  return { ok: true, userId, contactName: fullName(contacto), email, reutilizado };
}
