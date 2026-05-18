export function isOverdue(
  dueDate: Date | string | null | undefined,
  status?: string
): boolean {
  if (!dueDate) return false;
  if (status === "COMPLETADO" || status === "CERRADO") return false;
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return due.getTime() < Date.now();
}
