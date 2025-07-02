import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: ["signup.sapphirebroking.com"],
  },
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"], 
    },
  },
};

export default nextConfig;