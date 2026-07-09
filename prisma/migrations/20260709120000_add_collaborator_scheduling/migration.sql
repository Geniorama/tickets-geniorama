-- CreateEnum
CREATE TYPE "SchedulingLinkCategory" AS ENUM ('PROYECTOS', 'SOPORTE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "is_project_manager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_support_agent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "scheduling_links" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "category" "SchedulingLinkCategory" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduling_links_user_id_idx" ON "scheduling_links"("user_id");

-- AddForeignKey
ALTER TABLE "scheduling_links" ADD CONSTRAINT "scheduling_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
