import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/recherche", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
