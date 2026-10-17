import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  webpack: (config) => { config.output.hashSalt = "sks-studio-20261017-final"; return config; },
  basePath: "/apps/event-creator-v2",
  trailingSlash: true,
  images: { unoptimized: true },

};

export default nextConfig;
