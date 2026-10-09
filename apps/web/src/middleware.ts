import { NextResponse, type NextRequest } from "next/server";

/**
 * reqId 链路入口（rules/observability §4）：请求唯一 ID 在此生成并经响应头 X-Request-Id 返回；
 * 后续透传到后台 worker/外部调用，同一操作的全部日志可按 reqId 聚合检索。
 */
export function middleware(_request: NextRequest) {
  const reqId = crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set("X-Request-Id", reqId);
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
