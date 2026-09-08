/**
 * Cómo se nombra una entrada de bóveda en un selector.
 *
 * Está aquí y no en cada selector porque el alta de un ticket y su ficha
 * ofrecen la misma lista: si una dijera «Hosting» y la otra «Hosting — admin»,
 * parecerían accesos distintos.
 */
export function vaultOptionLabel(entry: { title: string; username: string | null }): string {
  return entry.username ? `${entry.title} — ${entry.username}` : entry.title;
}
