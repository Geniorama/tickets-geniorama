import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Iniciar sesión — Geniorama Tickets" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string }>;
}) {
  const { activated } = await searchParams;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#000a3d" }}
    >
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="https://i.imgur.com/pTemb33.png"
            alt="Geniorama"
            width={200}
            height={60}
            className="object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Bienvenido</h2>
          <p className="text-sm text-gray-400 mb-6">Ingresa tus credenciales para continuar</p>

          {activated && (
            <div className="mb-5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ✓ Cuenta activada. Ya puedes iniciar sesión.
            </div>
          )}

          <LoginForm />
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © {new Date().getFullYear()} Geniorama. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
