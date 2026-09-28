import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./problems/**/*.md"],
  },
};

export default nextConfig;
