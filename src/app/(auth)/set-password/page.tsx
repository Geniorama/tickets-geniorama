import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata = { title: "Activar cuenta — Geniorama Tickets" };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) notFound();

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: { expiresAt: true, user: { select: { name: true } } },
  });

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 [color-scheme:light]">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">El enlace no es válido o ya fue utilizado.</p>
          <a href="/login" className="mt-4 inline-block text-indigo-600 hover:underline text-sm">
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  if (record.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 [color-scheme:light]">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">El enlace ha expirado.</p>
          <p className="text-sm text-gray-500 mt-2">Pide al administrador que te reenvíe la invitación.</p>
          <a href="/login" className="mt-4 inline-block text-indigo-600 hover:underline text-sm">
            Ir al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 [color-scheme:light]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Geniorama</h1>
          <p className="text-gray-500 mt-1">Sistema de Tickets</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Activar cuenta</h2>
          <p className="text-sm text-gray-500 mb-6">
            Hola <strong>{record.user.name}</strong>, establece tu contraseña para continuar.
          </p>
          <SetPasswordForm token={token} />
        </div>
      </div>
    </div>
  );
}
