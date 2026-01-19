import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/**": [
      "./src/generated/prisma/**/*",
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/@prisma/engines/**/*",
    ],
  },
};

export default nextConfig;
