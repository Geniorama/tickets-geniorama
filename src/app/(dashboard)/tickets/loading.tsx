import { ListPageSkeleton } from "@/components/ui/skeleton";

export default function TicketsLoading() {
  return <ListPageSkeleton filters={4} columns={6} />;
}
