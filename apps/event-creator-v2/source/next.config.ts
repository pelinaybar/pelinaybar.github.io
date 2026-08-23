import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/apps/event-creator-v2",
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
