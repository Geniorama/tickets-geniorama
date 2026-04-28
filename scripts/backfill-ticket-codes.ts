/**
 * Backfill prefix/number en tickets existentes (number = 0).
 *
 * Resuelve el nombre de empresa por plan.company → client.companies[0] → null.
 * Asigna number correlativo dentro de cada prefijo, ordenado por createdAt asc.
 * Idempotente: arranca el contador en max(number) actual del prefijo, así que
 * tickets creados después de la migración no se renumeran.
 *
 * Uso: npx tsx scripts/backfill-ticket-codes.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { ticketPrefix } from "../src/lib/ticket-code";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const tickets = await prisma.ticket.findMany({
    where: { number: 0 },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      planId: true,
      clientId: true,
    },
  });

  console.log(`Encontrados ${tickets.length} ticket(s) sin código.`);
  if (tickets.length === 0) return;

  // Cache empresa por planId y por clientId para no repetir queries
  const planCompanyCache = new Map<string, string | null>();
  const clientCompanyCache = new Map<string, string | null>();
  const counterByPrefix = new Map<string, number>();

  async function resolveCompanyName(planId: string | null, clientId: string | null): Promise<string | null> {
    if (planId) {
      if (!planCompanyCache.has(planId)) {
        const plan = await prisma.plan.findUnique({
          where: { id: planId },
          select: { company: { select: { name: true } } },
        });
        planCompanyCache.set(planId, plan?.company?.name ?? null);
      }
      const name = planCompanyCache.get(planId);
      if (name) return name;
    }
    if (clientId) {
      if (!clientCompanyCache.has(clientId)) {
        const client = await prisma.user.findUnique({
          where: { id: clientId },
          select: { companies: { select: { name: true }, take: 1 } },
        });
        clientCompanyCache.set(clientId, client?.companies[0]?.name ?? null);
      }
      return clientCompanyCache.get(clientId) ?? null;
    }
    return null;
  }

  async function nextNumber(prefix: string): Promise<number> {
    if (!counterByPrefix.has(prefix)) {
      const last = await prisma.ticket.findFirst({
        where: { prefix },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      counterByPrefix.set(prefix, last?.number ?? 0);
    }
    const next = counterByPrefix.get(prefix)! + 1;
    counterByPrefix.set(prefix, next);
    return next;
  }

  let updated = 0;
  for (const t of tickets) {
    const companyName = await resolveCompanyName(t.planId, t.clientId);
    const prefix = ticketPrefix(companyName);
    const number = await nextNumber(prefix);
    await prisma.ticket.update({
      where: { id: t.id },
      data: { prefix, number },
    });
    updated++;
    if (updated % 50 === 0) console.log(`  …${updated}/${tickets.length}`);
  }

  console.log(`Listo. Actualizados ${updated} ticket(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
