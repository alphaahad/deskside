import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + data files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The agent reads the mock invoice PDFs from disk inside the serverless function.
  outputFileTracingIncludes: {
    "/api/agent/**": ["./public/invoices/**"],
    "/api/mcp": ["./public/invoices/**"],
    "/api/readiness": ["./public/samples/**"],
  },
};

export default nextConfig;
