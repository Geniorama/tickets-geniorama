export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export function getPageSize(value: string | undefined, fallback: number = DEFAULT_PAGE_SIZE): number {
  const parsed = parseInt(value ?? "", 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? parsed : fallback;
}
