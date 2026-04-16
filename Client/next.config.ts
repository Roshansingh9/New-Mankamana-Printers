import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack: dramatically faster HMR and cold starts in dev
  turbopack: {},

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "hvvdnlsrwpenyulgfgsz.supabase.co" },
      { protocol: "http", hostname: "**.supabase.co" },
      { protocol: "http", hostname: "localhost" },
    ],
    // Cache images longer in production
    minimumCacheTTL: 3600,
    formats: ["image/webp", "image/avif"],
  },

  // Compress responses
  compress: true,

  // Suppress noisy hydration logs in dev
  reactStrictMode: true,

  // Reduce bundle size by excluding server-only code from client bundle
  serverExternalPackages: [],
};

export default nextConfig;
