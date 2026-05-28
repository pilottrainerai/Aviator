import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pixi.js", "three", "@react-three/fiber", "@react-three/drei"],
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
