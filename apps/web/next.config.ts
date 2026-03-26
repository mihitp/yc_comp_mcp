import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    dirs: ["app"],
    ignoreDuringBuilds: false,
  },
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
