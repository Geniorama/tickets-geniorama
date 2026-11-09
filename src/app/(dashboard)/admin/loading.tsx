import { ListPageSkeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return <ListPageSkeleton filters={3} columns={5} />;
}
