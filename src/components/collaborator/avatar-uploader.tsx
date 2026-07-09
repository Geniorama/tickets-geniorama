"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Trash2 } from "lucide-react";
import { updateMyAvatar, removeMyAvatar } from "@/actions/profile.actions";

export function AvatarUploader({
  currentUrl,
  name,
}: {
  currentUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shownUrl = preview ?? currentUrl;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("La foto no puede superar los 5 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const formData = new FormData();
    formData.set("avatar", file);
    startTransition(async () => {
      const res = await updateMyAvatar(formData);
      if (res?.error) {
        setError(res.error);
        setPreview(null);
      } else {
        router.refresh();
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await removeMyAvatar();
      if (res?.error) setError(res.error);
      else {
        setPreview(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        title="Cambiar foto de perfil"
        className="relative w-20 h-20 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center group shrink-0"
      >
        {shownUrl ? (
          <Image src={shownUrl} alt={name} fill sizes="80px" className="object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-gray-400">{initial}</span>
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-5 h-5 text-white" />
        </span>
      </button>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-60"
        >
          <Camera className="w-3.5 h-3.5" />
          {isPending ? "Subiendo..." : currentUrl ? "Cambiar foto" : "Subir foto"}
        </button>
        {currentUrl && !isPending && (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Quitar foto
          </button>
        )}
        <p className="text-xs text-gray-400">JPG, PNG, WebP o GIF · máx. 5 MB</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
