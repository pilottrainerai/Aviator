import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pixi.js"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
