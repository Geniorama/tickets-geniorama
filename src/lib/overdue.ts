export function isOverdue(
  dueDate: Date | string | null | undefined,
  status?: string
): boolean {
  if (!dueDate) return false;
  // Finalizado, anulado o esperando al cliente: no hay nada que el equipo esté atrasando
  if (status === "COMPLETADO" || status === "CERRADO" || status === "ANULADO" || status === "ESPERA_CLIENTE") return false;
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  return due.getTime() < Date.now();
}
