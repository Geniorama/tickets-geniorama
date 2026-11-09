import { ListPageSkeleton } from "@/components/ui/skeleton";

export default function TicketTemplatesLoading() {
  return <ListPageSkeleton filters={0} columns={4} rows={6} />;
}
