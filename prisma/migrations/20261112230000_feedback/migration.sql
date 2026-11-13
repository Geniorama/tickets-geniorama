-- Buzón de feedback (AG·P-1). Aditiva: solo tablas y tipos nuevos.

CREATE TYPE "FeedbackType" AS ENUM ('ERROR', 'IDEA', 'CONFUSO', 'OTRO');
CREATE TYPE "FeedbackStatus" AS ENUM ('NUEVO', 'EN_REVISION', 'CONVERTIDO', 'DESCARTADO');

CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NUEVO',
    "user_id" TEXT,
    "user_name" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "company_id" TEXT,
    "company_name" TEXT,
    "page_url" TEXT,
    "user_agent" TEXT,
    "viewport" TEXT,
    "screenshot_url" TEXT,
    "screenshot_path" TEXT,
    "task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");
CREATE INDEX "feedback_type_idx" ON "feedback"("type");
CREATE INDEX "feedback_company_id_idx" ON "feedback"("company_id");
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
