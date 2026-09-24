-- Agendamiento prioritario: un link de agendamiento puede reservarse para los
-- clientes cuyo plan incluye soporte prioritario. Al resto se le muestra
-- bloqueado, con la invitación a elevar su plan.
--
-- Aditivo y con valor por defecto: los planes y links existentes quedan como
-- estaban (sin prioridad), así que nadie pierde acceso a lo que ya usaba.
ALTER TABLE "plans" ADD COLUMN "priority_support" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "scheduling_links" ADD COLUMN "is_priority" BOOLEAN NOT NULL DEFAULT false;
