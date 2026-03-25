import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { SortableHeader } from "@/components/ui/sortable-header";
import { ResendInvitationButton } from "@/components/admin/resend-invitation-button";
import { ToggleUserActiveButton } from "@/components/admin/toggle-user-active-button";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { Pencil } from "lucide-react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMINISTRADOR" | "COLABORADOR" | "CLIENTE";
  isActive: boolean;
  companies: { name: string }[];
  createdAt: Date;
};

const ROLE_LABELS = {
  ADMINISTRADOR: "Administrador",
  COLABORADOR: "Colaborador",
  CLIENTE: "Cliente",
};

export function UsersTable({
  users,
  currentUserId,
  sortBy,
  sortDir,
  paramsStr,
}: {
  users: UserRow[];
  currentUserId: string;
  sortBy: string;
  sortDir: string;
  paramsStr: string;
}) {
  const sharedProps = { sortBy, sortDir, basePath: "/admin/users", paramsStr };

  // "company" can't be sorted server-side (many-to-many), so we sort the current page here
  const displayUsers = sortBy === "company"
    ? [...users].sort((a, b) => {
        const an = a.companies[0]?.name ?? "";
        const bn = b.companies[0]?.name ?? "";
        return sortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
      })
    : users;

  const cardContainer: React.CSSProperties = {
    backgroundColor: "var(--app-card-bg)",
    border: "1px solid var(--app-border)",
    borderRadius: "0.75rem",
    overflow: "hidden",
  };

  const roleBadge: React.CSSProperties = {
    fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem",
    borderRadius: "9999px", backgroundColor: "rgba(253,19,132,0.12)", color: "#fd1384",
  };

  function statusBadge(isActive: boolean): React.CSSProperties {
    return {
      fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px",
      backgroundColor: isActive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
      color: isActive ? "#22c55e" : "#f87171",
    };
  }

  if (users.length === 0) {
    return (
      <div style={{ ...cardContainer, padding: "2.5rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
        No hay usuarios.
      </div>
    );
  }

  return (
    <div style={cardContainer}>
      {/* ── Vista mobile: cards ── */}
      <ul className="md:hidden divide-y" style={{ borderColor: "var(--app-border)" }}>
        {displayUsers.map((user) => (
          <li key={user.id} style={{ padding: "0.875rem 1rem", opacity: user.isActive ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.375rem" }}>
              <Link href={`/admin/users/${user.id}`} style={{ fontWeight: 600, color: "var(--app-body-text)", textDecoration: "none", fontSize: "0.9375rem" }}>
                {user.name}
              </Link>
              <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                <span style={roleBadge}>{ROLE_LABELS[user.role]}</span>
                <span style={statusBadge(user.isActive)}>{user.isActive ? "Activo" : "Inactivo"}</span>
              </div>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>{user.email}</p>
            {user.companies.length > 0 && (
              <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{user.companies.map((c) => c.name).join(", ")}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.625rem", flexWrap: "wrap" }}>
              <ToggleUserActiveButton userId={user.id} isActive={user.isActive} isSelf={user.id === currentUserId} />
              <ResendInvitationButton userId={user.id} />
              <Link href={`/admin/users/${user.id}/edit`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none" }}>
                <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
                Editar
              </Link>
              <DeleteUserButton userId={user.id} userName={user.name} isSelf={user.id === currentUserId} />
            </div>
          </li>
        ))}
      </ul>

      {/* ── Vista desktop: tabla ── */}
      <div className="hidden md:block overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
              <SortableHeader label="Nombre"  column="name"      {...sharedProps} />
              <SortableHeader label="Email"   column="email"     {...sharedProps} />
              <SortableHeader label="Empresa" column="company"   {...sharedProps} />
              <SortableHeader label="Rol"     column="role"      {...sharedProps} />
              <SortableHeader label="Estado"  column="isActive"  {...sharedProps} />
              <SortableHeader label="Creado"  column="createdAt" {...sharedProps} />
              <th style={{ padding: "0.75rem 1rem" }} />
            </tr>
          </thead>
          <tbody>
            {displayUsers.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid var(--app-border)", opacity: user.isActive ? 1 : 0.6 }}>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <Link href={`/admin/users/${user.id}`} style={{ fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none" }}>
                    {user.name}
                  </Link>
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>{user.email}</td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                  {user.companies.length > 0 ? user.companies.map((c) => c.name).join(", ") : "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}><span style={roleBadge}>{ROLE_LABELS[user.role]}</span></td>
                <td style={{ padding: "0.75rem 1rem" }}><span style={statusBadge(user.isActive)}>{user.isActive ? "Activo" : "Inactivo"}</span></td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>{formatDate(user.createdAt)}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <ToggleUserActiveButton userId={user.id} isActive={user.isActive} isSelf={user.id === currentUserId} />
                    <ResendInvitationButton userId={user.id} />
                    <Link href={`/admin/users/${user.id}/edit`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none" }}>
                      <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
                      Editar
                    </Link>
                    <DeleteUserButton userId={user.id} userName={user.name} isSelf={user.id === currentUserId} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
