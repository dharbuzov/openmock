import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./problems/**/*.md", "./prompts/*.md"],
  },
};

export default nextConfig;
