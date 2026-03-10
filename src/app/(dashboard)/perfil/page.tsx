import { getRequiredSession } from "@/lib/auth-helpers";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { KeyRound } from "lucide-react";

export const metadata = { title: "Mi perfil — Geniorama Tickets" };

export default async function PerfilPage() {
  const session = await getRequiredSession();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      {/* User info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <p className="text-xs text-gray-500 mb-0.5">Nombre</p>
        <p className="text-sm font-medium text-gray-900 mb-4">{session.user.name}</p>
        <p className="text-xs text-gray-500 mb-0.5">Email</p>
        <p className="text-sm font-medium text-gray-900">{session.user.email}</p>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">Cambiar contraseña</h2>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
