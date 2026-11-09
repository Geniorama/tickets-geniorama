import { ListPageSkeleton } from "@/components/ui/skeleton";

export default function MiFacturacionLoading() {
  return <ListPageSkeleton filters={0} columns={5} rows={6} action={false} />;
}
