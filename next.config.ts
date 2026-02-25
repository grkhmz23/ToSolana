import type { NextConfig } from "next";

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN?.replace(/^https?:\/\//, "").trim();
const allowedDevOrigins = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  ...(replitDevDomain ? [`https://${replitDevDomain}`, `http://${replitDevDomain}`] : []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  turbopack: {},
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding", "viem"],
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
      "@coinbase/wallet-sdk": false,
      "@metamask/sdk": false,
      porto: false,
      "porto/internal": false,
    };
    return config;
  },
};

export default nextConfig;
