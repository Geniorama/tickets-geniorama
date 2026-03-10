import Image from "next/image";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "Recuperar contraseña — Geniorama Tickets" };

export default function ForgotPasswordPage() {
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
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Recuperar contraseña</h2>
          <p className="text-sm text-gray-400 mb-6">
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
          </p>
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          © {new Date().getFullYear()} Geniorama. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
