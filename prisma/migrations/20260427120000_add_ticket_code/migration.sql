-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "prefix" TEXT;
ALTER TABLE "tickets" ADD COLUMN "number" INTEGER NOT NULL DEFAULT 0;
