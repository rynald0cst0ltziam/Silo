import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The connector ZIP is generated at request time from the plugin source.
  outputFileTracingIncludes: {
    "/api/connector/download": ["./silo-connector/**/*"],
    // Store settings reads the plugin header to show the latest version.
    "/dashboard/stores/[id]/settings": ["./silo-connector/silo-connector.php"],
    "/docs": ["./silo-connector/silo-connector.php"],
  },
};

export default nextConfig;
