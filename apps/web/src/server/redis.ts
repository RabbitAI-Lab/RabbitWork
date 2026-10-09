import { Redis } from "ioredis";

const g = globalThis as unknown as { __redis?: Redis };

/** Redis 单例（未配置 REDIS_URL 时返回 null——readiness 按「未配置不检」口径处理）。 */
export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!g.__redis) {
    g.__redis = new Redis(url, { maxRetriesPerRequest: 1 });
    // 连接失败由调用方 ping 感知；未处理的 error 事件会刷未捕获异常
    g.__redis.on("error", (e) => {
      // 仅吞连接类噪声，业务错误照常由 ping 命令抛出
      if (!/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(String(e?.message))) throw e;
    });
  }
  return g.__redis;
}
