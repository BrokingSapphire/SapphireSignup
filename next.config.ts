import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    domains: ['signup.sapphirebroking.com'],
  },
};

export default nextConfig;
