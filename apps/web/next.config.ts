import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kti/schema", "@kti/linter"],
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "better-sqlite3"],
};

export default nextConfig;
