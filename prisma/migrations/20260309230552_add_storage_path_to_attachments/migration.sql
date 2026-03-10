/*
  Warnings:

  - Added the required column `storage_path` to the `ticket_attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ticket_attachments" ADD COLUMN     "storage_path" TEXT NOT NULL;
