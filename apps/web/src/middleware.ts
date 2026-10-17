import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@rabbit/shared";

/**
 * reqId 链路入口 + 页面/接口鉴权门（rules/observability §4；SYS-001）：
 * 页面未登录 → /login；API 未登录 → 401 信封；已登录访问 /login → /staffs。
 */
export async function middleware(request: NextRequest) {
  const reqId = crypto.randomUUID();
  const { pathname } = request.nextUrl;
  const secret = process.env.SESSION_SECRET ?? "change-me-to-a-random-32-chars-secret!";
  const claims = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret);

  const isApi = pathname.startsWith("/api/");
  const isPublicApi =
    pathname.startsWith("/api/v1/auth/") || pathname.startsWith("/api/v1/system/");

  let res: NextResponse;
  if (!claims && isApi && !isPublicApi) {
    res = NextResponse.json(
      { code: 10001, message: "未登录或会话已过期", data: null },
      { status: 401 },
    );
  } else if (!claims && !isApi && !pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    res = NextResponse.redirect(url);
  } else if (claims && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/office";
    url.search = "";
    res = NextResponse.redirect(url);
  } else {
    res = NextResponse.next();
  }
  res.headers.set("X-Request-Id", reqId);
  return res;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
