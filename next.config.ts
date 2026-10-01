import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./content/interviews/*.md",
      "./content/problems/**/*.md",
      "./content/prompts/*.md",
    ],
  },
};

export default nextConfig;
