import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    dirs: ["app"],
    ignoreDuringBuilds: false,
  },
  transpilePackages: ["@yc-mcp/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bookface-images.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
    ],
  },
}

export default nextConfig
