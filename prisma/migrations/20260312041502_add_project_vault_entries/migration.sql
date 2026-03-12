-- CreateTable
CREATE TABLE "project_vault_entries" (
    "project_id" TEXT NOT NULL,
    "vault_entry_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_vault_entries_pkey" PRIMARY KEY ("project_id","vault_entry_id")
);

-- AddForeignKey
ALTER TABLE "project_vault_entries" ADD CONSTRAINT "project_vault_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_vault_entries" ADD CONSTRAINT "project_vault_entries_vault_entry_id_fkey" FOREIGN KEY ("vault_entry_id") REFERENCES "vault_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
