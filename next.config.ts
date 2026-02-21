import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
};

export default nextConfig;
