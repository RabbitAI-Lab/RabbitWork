import { ok } from "@rabbit/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** liveness（rules/observability §5）：进程存活；部署与 CI 启动等待以 /ready 为准。 */
export function GET() {
  return Response.json(ok({ status: "alive" }));
}
