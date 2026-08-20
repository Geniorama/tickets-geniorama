/**
 * Lectura y escritura de tareas (y sus proyectos) desde la API pública.
 *
 * Mismo criterio que en tickets: se replica el contrato de negocio de las
 * Server Actions —consecutivo por proyecto, revisor por defecto, avisos al
 * asignado— sin depender de que exista una sesión de navegador.
 *
 * Escribir tareas es cosa del equipo. Un cliente con llave puede *leer* las
 * tareas de los proyectos de sus empresas, que es exactamente lo que ve en la
 * plataforma, pero no crearlas ni moverlas.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, Priority, TaskStatus } from "@/generated/prisma";
import { isStaff } from "@/lib/roles";
import { notify } from "@/lib/notify";
import { emitTaskHook } from "@/lib/hooks/dispatch";
import { serializeProject, serializeTask, projectSelect, taskSelect } from "@/lib/hooks/payload";
import type { ApiUser } from "@/lib/api/respond";
import type { WriteResult } from "@/lib/api/tickets";

// ─── Frontera de datos ───────────────────────────────────────────────────────

async function companyIdsOf(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companies: { select: { id: true } } },
  });
  return (user?.companies ?? []).map((c) => c.id);
}

async function taskScopeWhere(user: ApiUser): Promise<Prisma.TaskWhereInput> {
  if (isStaff(user.role)) {
    return { OR: [{ isDraft: false }, { createdById: user.id }] };
  }
  const companyIds = await companyIdsOf(user.id);
  // Sin empresas no hay nada que ver: un `in: []` no devuelve filas, que es
  // justo lo que se quiere.
  return { isDraft: false, project: { companyId: { in: companyIds } } };
}

async function projectScopeWhere(user: ApiUser): Promise<Prisma.ProjectWhereInput> {
  if (isStaff(user.role)) {
    // Los proyectos privados solo los ve quien está dentro.
    return {
      OR: [
        { isPrivate: false },
        { members: { some: { userId: user.id } } },
        { managerId: user.id },
        { createdById: user.id },
      ],
    };
  }
  const companyIds = await companyIdsOf(user.id);
  return { isPrivate: false, companyId: { in: companyIds } };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function listTasks(
  user: ApiUser,
  opts: {
    limit: number;
    cursor: string | null;
    projectId?: string;
    status?: string;
    assignedToId?: string;
  },
) {
  const scope = await taskScopeWhere(user);

  const rows = await prisma.task.findMany({
    where: {
      AND: [
        scope,
        ...(opts.projectId ? [{ projectId: opts.projectId }] : []),
        ...(opts.status ? [{ status: opts.status as TaskStatus }] : []),
        ...(opts.assignedToId ? [{ assignedToId: opts.assignedToId }] : []),
      ],
    },
    select: taskSelect,
    orderBy: { createdAt: "desc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    tasks: page.map(serializeTask),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getTask(user: ApiUser, taskId: string) {
  const scope = await taskScopeWhere(user);
  const row = await prisma.task.findFirst({
    where: { AND: [{ id: taskId }, scope] },
    select: taskSelect,
  });
  return row ? serializeTask(row) : null;
}

export async function listProjects(user: ApiUser, opts: { limit: number; cursor: string | null }) {
  const scope = await projectScopeWhere(user);

  const rows = await prisma.project.findMany({
    where: scope,
    select: projectSelect,
    orderBy: { createdAt: "desc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    projects: page.map(serializeProject),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getProject(user: ApiUser, projectId: string) {
  const scope = await projectScopeWhere(user);
  const row = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    select: projectSelect,
  });
  return row ? serializeProject(row) : null;
}

// ─── Creación ────────────────────────────────────────────────────────────────

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description: string;
  priority?: Priority;
  category?: string | null;
  assignedToId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  estimatedHours?: number | null;
  externalRef?: string | null;
};

export async function createTaskViaApi(
  author: ApiUser,
  input: CreateTaskInput,
): Promise<WriteResult<ReturnType<typeof serializeTask>> & { duplicate?: boolean }> {
  if (!isStaff(author.role)) {
    return { ok: false, status: 403, error: "Solo el equipo puede crear tareas." };
  }

  // Idempotencia: si la integración reintenta la misma ejecución, se devuelve la
  // tarea que ya creó en vez de duplicarla. Es el mismo mecanismo del webhook de
  // briefs, y el motivo por el que `external_ref` tiene índice único.
  if (input.externalRef) {
    const existing = await prisma.task.findUnique({
      where: { externalRef: input.externalRef },
      select: taskSelect,
    });
    if (existing) return { ok: true, value: serializeTask(existing), duplicate: true };
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, name: true, isPrivate: true, managerId: true, createdById: true },
  });
  if (!project) {
    return { ok: false, status: 404, error: `No existe el proyecto ${input.projectId}` };
  }

  if (input.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) {
      return { ok: false, status: 404, error: "El usuario asignado no existe o está inactivo." };
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.task.findFirst({
      where: { projectId: project.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return tx.task.create({
      data: {
        number: (last?.number ?? 0) + 1,
        title: input.title.slice(0, 200),
        description: input.description,
        status: "PENDIENTE",
        priority: input.priority ?? "MEDIA",
        category: input.category ?? null,
        projectId: project.id,
        assignedToId: input.assignedToId ?? null,
        createdById: author.id,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimatedHours: input.estimatedHours ?? null,
        externalRef: input.externalRef ?? null,
        reviewers: { connect: [{ id: input.assignedToId ?? author.id }] },
      },
      select: taskSelect,
    });
  });

  if (created.assignedTo && created.assignedTo.id !== author.id) {
    await notify(
      created.assignedTo.id,
      "task_assigned",
      "Tarea asignada",
      `Se te asignó: "${created.title}" en ${project.name}`,
      `/proyectos/${project.id}/tareas/${created.id}`,
      true,
    );
  }

  emitTaskHook("task.created", created.id, {
    actor: { id: author.id, name: author.name },
    projectId: project.id,
    projectIsPrivate: project.isPrivate,
  });

  return { ok: true, value: serializeTask(created) };
}

// ─── Actualización ───────────────────────────────────────────────────────────

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  category?: string | null;
  assignedToId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  estimatedHours?: number | null;
};

export async function updateTaskViaApi(
  author: ApiUser,
  taskId: string,
  input: UpdateTaskInput,
): Promise<WriteResult<ReturnType<typeof serializeTask>>> {
  if (!isStaff(author.role)) {
    return { ok: false, status: 403, error: "Solo el equipo puede modificar tareas." };
  }

  const before = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      title: true,
      status: true,
      assignedToId: true,
      createdById: true,
      project: { select: { id: true, name: true, isPrivate: true } },
    },
  });
  if (!before) return { ok: false, status: 404, error: "Tarea no encontrada" };

  if (input.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) {
      return { ok: false, status: 404, error: "El usuario asignado no existe o está inactivo." };
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title.slice(0, 200) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
    },
    select: taskSelect,
  });

  const actor = { id: author.id, name: author.name };
  const scope = { projectId: before.project?.id ?? null, projectIsPrivate: before.project?.isPrivate ?? false };
  const taskUrl = before.project
    ? `/proyectos/${before.project.id}/tareas/${taskId}`
    : `/tareas/${taskId}`;

  if (input.status !== undefined && input.status !== before.status) {
    emitTaskHook("task.status_changed", taskId, {
      actor,
      ...scope,
      changes: { status: { from: before.status, to: input.status } },
    });

    if (input.status === "COMPLETADO") {
      const recipients = [before.createdById, before.assignedToId].filter(
        (id): id is string => !!id && id !== author.id,
      );
      for (const userId of recipients) {
        await notify(
          userId,
          "task_completed",
          "Tarea completada",
          `"${updated.title}" marcada como completada`,
          taskUrl,
          scope.projectIsPrivate,
        );
      }
      emitTaskHook("task.completed", taskId, { actor, ...scope });
    }
  }

  if (input.assignedToId !== undefined && input.assignedToId !== before.assignedToId) {
    if (input.assignedToId && input.assignedToId !== author.id) {
      await notify(
        input.assignedToId,
        "task_assigned",
        "Tarea asignada",
        `Se te asignó: "${updated.title}"`,
        taskUrl,
        true,
      );
    }
    emitTaskHook("task.assigned", taskId, {
      actor,
      ...scope,
      changes: { assignedToId: { from: before.assignedToId, to: input.assignedToId } },
    });
  }

  emitTaskHook("task.updated", taskId, { actor, ...scope });

  return { ok: true, value: serializeTask(updated) };
}
