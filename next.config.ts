import type { NextConfig } from "next";
import { config } from "@/lib/config/config";

const nextConfig: NextConfig = {
  // AI defaults are public configuration, inlined for browser-side Settings.
  env: {
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
