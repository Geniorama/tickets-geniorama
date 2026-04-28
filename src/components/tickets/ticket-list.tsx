"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { Role, Ticket, TicketStatus, Priority } from "@/generated/prisma";
import { formatDateTime, formatDate } from "@/lib/format-date";
import { StatusBadge, PriorityBadge } from "./ticket-status-badge";
import { isStaff } from "@/lib/roles";
import { ticketCode } from "@/lib/ticket-code";

type TicketWithRelations = Ticket & {
  createdBy: { name: string; companies: { name: string }[] };
  assignedTo: { name: string } | null;
  dueDate: Date | null;
};

function SortableHeader({
  label,
  column,
  sortBy,
  sortDir,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: string;
}) {
  const searchParams = useSearchParams();
  const isActive = sortBy === column;
  const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams(searchParams.toString());
  params.set("sortBy", column);
  params.set("sortDir", nextDir);
  params.delete("page");

  const Icon = isActive
    ? sortDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th className="text-left px-4 py-3 text-gray-600 font-medium">
      <Link
        href={`/tickets?${params.toString()}`}
        className={`inline-flex items-center gap-1 hover:text-indigo-600 transition-colors ${
          isActive ? "text-indigo-600" : ""
        }`}
      >
        {label}
        <Icon className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-30"}`} />
      </Link>
    </th>
  );
}

export function TicketList({
  tickets,
  role,
  sortBy = "createdAt",
  sortDir = "desc",
}: {
  tickets: TicketWithRelations[];
  role: Role;
  sortBy?: string;
  sortDir?: string;
}) {
  const staff = isStaff(role);

  if (tickets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No hay tickets que coincidan con los filtros.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Vista móvil: cards ── */}
      <ul className="md:hidden divide-y divide-gray-100">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link href={`/tickets/${ticket.id}`} className="block px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="font-medium text-gray-900 text-sm leading-snug">
                  {ticket.number > 0 && (
                    <span className="inline-block align-middle mr-1.5 px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold text-gray-500 bg-gray-50 border border-gray-200">
                      {ticketCode(ticket.prefix, ticket.number)}
                    </span>
                  )}
                  {ticket.title}
                </span>
                <PriorityBadge priority={ticket.priority as Priority} />
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <StatusBadge status={ticket.status as TicketStatus} />
                {ticket.category && (
                  <span className="text-xs text-gray-400">{ticket.category}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                <span>{ticket.createdBy.name}</span>
                {ticket.assignedTo && (
                  <span>→ {ticket.assignedTo.name}</span>
                )}
                {staff && ticket.createdBy.companies.length > 0 && (
                  <span className="text-gray-300">
                    {ticket.createdBy.companies.map((c) => c.name).join(", ")}
                  </span>
                )}
                <span>{formatDate(ticket.createdAt)}</span>
                {staff && ticket.dueDate && (
                  <span className="text-red-400">Límite: {formatDate(ticket.dueDate)}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* ── Vista desktop: tabla ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortableHeader label="Título"      column="title"      sortBy={sortBy} sortDir={sortDir} />
              <SortableHeader label="Estado"      column="status"     sortBy={sortBy} sortDir={sortDir} />
              <SortableHeader label="Prioridad"   column="priority"   sortBy={sortBy} sortDir={sortDir} />
              <SortableHeader label="Creado por"  column="createdBy"  sortBy={sortBy} sortDir={sortDir} />
              {staff && (
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Empresa</th>
              )}
              <SortableHeader label="Asignado a"  column="assignedTo" sortBy={sortBy} sortDir={sortDir} />
              <SortableHeader label="Creado"      column="createdAt"  sortBy={sortBy} sortDir={sortDir} />
              <SortableHeader label="Actualizado" column="updatedAt"  sortBy={sortBy} sortDir={sortDir} />
              {staff && <SortableHeader label="Fecha límite" column="dueDate" sortBy={sortBy} sortDir={sortDir} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="font-medium text-gray-900 hover:text-indigo-600"
                  >
                    {ticket.number > 0 && (
                      <span className="inline-block align-middle mr-1.5 px-1.5 py-0.5 rounded text-[0.6875rem] font-semibold text-gray-500 bg-gray-50 border border-gray-200">
                        {ticketCode(ticket.prefix, ticket.number)}
                      </span>
                    )}
                    {ticket.title}
                  </Link>
                  {ticket.category && (
                    <span className="ml-2 text-xs text-gray-400">{ticket.category}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ticket.status as TicketStatus} />
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={ticket.priority as Priority} />
                </td>
                <td className="px-4 py-3 text-gray-600">{ticket.createdBy.name}</td>
                {staff && (
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {ticket.createdBy.companies.length > 0
                      ? ticket.createdBy.companies.map((c) => c.name).join(", ")
                      : "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-500">
                  {ticket.assignedTo?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {formatDateTime(ticket.createdAt)}
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {formatDateTime(ticket.updatedAt)}
                </td>
                {staff && (
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {ticket.dueDate ? formatDate(ticket.dueDate) : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
