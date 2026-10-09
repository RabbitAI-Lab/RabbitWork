import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 阶段单独开启 standalone（磁盘/构建分层考虑）
  transpilePackages: ["@rabbit/shared", "@rabbit/db", "@rabbit/api-client", "@rabbit/ui"],
  // embedded-postgres/Prisma/pino/ioredis 均需 Node runtime（rules/react-nextjs §3.3）
  serverExternalPackages: ["pino", "ioredis"],
  // 安全响应头（rules/security.md）：HSTS 头在 http 传输时被浏览器忽略，本地开发无副作用
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
