import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.geniorama.co",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      // Logos migrados desde Supabase — se puede eliminar una vez re-subidos a R2
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
