import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project; a stray lockfile in the home
  // directory otherwise confuses Next's automatic root inference.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
