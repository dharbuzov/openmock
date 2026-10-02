import type { NextConfig } from "next";
import { config } from "@/lib/config/config";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pino"],
  // AI defaults are public configuration, inlined for browser-side Settings.
  env: {
    NEXT_PUBLIC_LOG_LEVEL:
      process.env.LOG_LEVEL ??
      process.env.NEXT_PUBLIC_LOG_LEVEL ??
      (process.env.NODE_ENV === "production" ? "info" : "debug"),
    OPENMOCK_AI_PROVIDER: config.ai.provider,
    OPENMOCK_AI_MODEL: config.ai.model,
  },
  outputFileTracingIncludes: {
    "/*": [
      "./content/interviews/*.md",
      "./content/problems/**/*.md",
      "./content/prompts/*.md",
    ],
  },
};

export default nextConfig;
