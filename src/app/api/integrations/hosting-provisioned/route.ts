import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateInvitationToken } from "@/actions/invitation.actions";
import { sendInvitationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  orderId: z.string().min(1),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  company: z.object({
    name: z.string().min(1),
    taxId: z.string().optional(),
  }),
  hosting: z.object({
    domain: z.string().min(1),
    planId: z.string().min(1),
    planName: z.string().min(1),
    billing: z.enum(["monthly", "annual"]),
    amount: z.number().nonnegative(),
    cpanelUsername: z.string().optional(),
    cpanelIp: z.string().optional(),
  }),
  startedAt: z.string().datetime().optional(),
});

type Payload = z.infer<typeof payloadSchema>;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function getExpectedToken(): string | null {
  return process.env.INTEGRATION_HOSTING_TOKEN ?? null;
}

function verifyAuth(req: Request): boolean {
  const expected = getExpectedToken();
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (!provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function calcExpiry(startedAt: Date, billing: "monthly" | "annual"): Date {
  const days = billing === "annual" ? 365 : 30;
  const out = new Date(startedAt);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export async function POST(req: Request) {
  if (!verifyAuth(req)) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data: Payload = parsed.data;
  const startedAt = data.startedAt ? new Date(data.startedAt) : new Date();
  const expiresAt = calcExpiry(startedAt, data.hosting.billing);
  const durationDays = data.hosting.billing === "annual" ? 365 : 30;

  let userInvitationSent = false;

  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: data.customer.email } });

    if (!user) {
      const randomPwd = crypto.randomBytes(24).toString("base64url");
      const passwordHash = await bcrypt.hash(randomPwd, 12);
      user = await tx.user.create({
        data: {
          name: data.customer.name,
          email: data.customer.email,
          passwordHash,
          role: "CLIENTE",
        },
      });
    }

    let company = data.company.taxId
      ? await tx.company.findFirst({ where: { taxId: data.company.taxId } })
      : await tx.company.findFirst({
          where: { name: { equals: data.company.name, mode: "insensitive" } },
        });

    if (!company) {
      company = await tx.company.create({
        data: {
          name: data.company.name,
          taxId: data.company.taxId ?? null,
          type: "EMPRESA",
        },
      });
    }

    await tx.user.update({
      where: { id: user.id },
      data: { companies: { connect: { id: company.id } } },
    });

    const existingService = await tx.service.findFirst({
      where: {
        companyId: company.id,
        type: "HOSTING",
        name: data.hosting.domain,
      },
    });

    const serviceNotes = [
      `Pedido: ${data.orderId}`,
      data.hosting.cpanelUsername ? `cPanel user: ${data.hosting.cpanelUsername}` : "",
      data.hosting.cpanelIp ? `IP: ${data.hosting.cpanelIp}` : "",
      `Plan hosting: ${data.hosting.planName} (${data.hosting.billing})`,
    ]
      .filter(Boolean)
      .join("\n");

    const service = existingService
      ? await tx.service.update({
          where: { id: existingService.id },
          data: { dueDate: expiresAt, price: data.hosting.amount, notes: serviceNotes, isActive: true },
        })
      : await tx.service.create({
          data: {
            name: data.hosting.domain,
            type: "HOSTING",
            provider: "GENIORAMA",
            description: `Hosting ${data.hosting.planName}`,
            dueDate: expiresAt,
            price: data.hosting.amount,
            notes: serviceNotes,
            isActive: true,
            companyId: company.id,
            createdById: user.id,
          },
        });

    const plan = await tx.plan.create({
      data: {
        name: `Soporte Hosting ${data.hosting.planName}`,
        type: "SOPORTE_MENSUAL",
        durationDays,
        startedAt,
        expiresAt,
        isActive: true,
        companyId: company.id,
      },
    });

    return { user, company, service, plan, userIsNew: !user.passwordHash || user.createdAt.getTime() === user.updatedAt.getTime() };
  });

  if (result.userIsNew) {
    try {
      const token = await generateInvitationToken(result.user.id);
      const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
      const url = `${baseUrl}/set-password?token=${token}`;
      await sendInvitationEmail(
        { name: result.user.name, email: result.user.email },
        url,
      );
      userInvitationSent = true;
    } catch (err) {
      console.error("[integrations:hosting-provisioned] invitation email failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    userId: result.user.id,
    companyId: result.company.id,
    serviceId: result.service.id,
    planId: result.plan.id,
    userInvitationSent,
    expiresAt: expiresAt.toISOString(),
  });
}
