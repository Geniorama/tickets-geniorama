import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/roles";
import { Ticket, CircleDot, Loader2, CheckCircle2 } from "lucide-react";

export const metadata = { title: "Dashboard — Geniorama Tickets" };

export default async function DashboardPage() {
  const session = await getRequiredSession();
  const { id, role } = session.user;

  const whereClause = isStaff(role) ? {} : { OR: [{ createdById: id }, { clientId: id }] };

  const [total, abiertos, enProgreso, cerrados] = await Promise.all([
    prisma.ticket.count({ where: whereClause }),
    prisma.ticket.count({ where: { ...whereClause, status: "ABIERTO" } }),
    prisma.ticket.count({ where: { ...whereClause, status: "EN_PROGRESO" } }),
    prisma.ticket.count({ where: { ...whereClause, status: "CERRADO" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Bienvenido, {session.user.name}
      </h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total tickets"  value={total}      color="blue"   icon={Ticket} />
        <StatCard label="Abiertos"       value={abiertos}   color="yellow" icon={CircleDot} />
        <StatCard label="En progreso"    value={enProgreso} color="indigo" icon={Loader2} />
        <StatCard label="Cerrados"       value={cerrados}   color="green"  icon={CheckCircle2} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: "blue" | "yellow" | "indigo" | "green";
  icon: React.ElementType;
}) {
  const colors = {
    blue:   { number: "text-blue-700",   icon: "bg-blue-50 text-blue-500" },
    yellow: { number: "text-yellow-700", icon: "bg-yellow-50 text-yellow-500" },
    indigo: { number: "text-indigo-700", icon: "bg-indigo-50 text-indigo-500" },
    green:  { number: "text-green-700",  icon: "bg-green-50 text-green-500" },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${colors[color].icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-3xl font-bold ${colors[color].number}`}>{value}</p>
      </div>
    </div>
  );
}
