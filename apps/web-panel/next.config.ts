import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@spark/shared", "@spark/database"],
  output: "standalone"
};

export default nextConfig;
