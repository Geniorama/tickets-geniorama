import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * SSL va activado por defecto —RDS lo exige— salvo que la URL diga
 * explícitamente `sslmode=disable`. Sin esa salida, un Postgres local sin TLS
 * no se puede usar ni para pruebas: el adaptador intenta negociar cifrado
 * contra un servidor que no lo ofrece y falla al conectar.
 */
function sslFor(url: string): { rejectUnauthorized: boolean } | false {
  return /[?&]sslmode=disable\b/.test(url) ? false : { rejectUnauthorized: false };
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({
    connectionString,
    max: 10,
    ssl: sslFor(connectionString),
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
