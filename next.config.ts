import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The connector ZIP is generated at request time from the plugin source.
  outputFileTracingIncludes: {
    "/api/connector/download": ["./silo-connector/**/*"],
  },
};

export default nextConfig;
