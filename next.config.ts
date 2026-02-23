import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow both Turbopack and webpack config for compatibility
  turbopack: {},
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  transpilePackages: [
    "@rango-dev/widget-embedded",
    "@rango-dev/provider-all",
    "@rango-dev/provider-ledger",
  ],
  webpack: (config) => {
    // Handle missing modules in Rango provider-ledger
    config.resolve.alias = {
      ...config.resolve.alias,
      "./core": false,
      "./sha256": false,
      "./internal": false,
      "./rng": false,
      "./aes": false,
      "./bs58": false,
      "./hash": false,
      "./hmac": false,
      "./pbkdf2": false,
      "./sha512": false,
    };
    return config;
  },
};

export default nextConfig;
