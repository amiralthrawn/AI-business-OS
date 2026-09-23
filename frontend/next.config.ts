import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` blocks /_next/* (incl. the HMR socket) from non-localhost
  // origins, which prevents hydration behind the demo's Cloudflare Quick
  // Tunnel (demo.ps1). Dev-only; ignored by `next build`/`next start`.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
