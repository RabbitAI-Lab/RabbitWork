/** Route Handler 收口：信封响应、DomainError/上游错误归一、zod 解析（api-conventions §2/§3）。 */
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AgentScopeError } from "@rabbit/agentscope";
import { DomainError, ErrCode, fail, ok, type Envelope } from "@rabbit/shared";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(ok(data), init);
}

const STATUS_BY_CODE: Record<number, number> = {
  [ErrCode.UNAUTHENTICATED]: 401,
  [ErrCode.FORBIDDEN]: 403,
  [ErrCode.NOT_FOUND]: 404,
  [ErrCode.VALIDATION_FAILED]: 422,
  [ErrCode.STAFF_CODE_DUP]: 409,
  [ErrCode.STAFF_NOT_PUBLISHED]: 409,
  [ErrCode.STAFF_STATE_INVALID]: 409,
  [ErrCode.RUN_CONFLICT]: 409,
  [ErrCode.DEGRADED]: 503,
  [ErrCode.AGENTSCOPE_ERROR]: 502,
};

export function jsonError(code: number, message: string): Response {
  return Response.json(fail(code, message), { status: STATUS_BY_CODE[code] ?? 500 });
}

/** 统一错误 → 信封响应（route 内 throw DomainError 即可） */
export function toErrorResponse(e: unknown): Response {
  if (e instanceof DomainError) return jsonError(e.code, e.message);
  if (e instanceof ZodError) {
    return jsonError(
      ErrCode.VALIDATION_FAILED,
      e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  if (e instanceof AgentScopeError) {
    // AgentScope 不可达（网络层）→ 503 DEGRADED；上游语义错误 → 502 AGENTSCOPE_ERROR
    if (
      e.status === 0 ||
      e.name === "TypeError" ||
      e.message.includes("fetch failed") ||
      e.status === 503
    ) {
      return jsonError(ErrCode.DEGRADED, "AgentScope 服务不可用");
    }
    return jsonError(ErrCode.AGENTSCOPE_ERROR, e.message);
  }
  console.error("[route] unhandled", e);
  return jsonError(ErrCode.INTERNAL, "内部错误");
}

export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new DomainError(ErrCode.VALIDATION_FAILED, "请求体必须是 JSON");
  }
  return schema.parse(raw) as z.output<S>;
}

export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.output<S> {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return schema.parse(obj) as z.output<S>;
}

export type { Envelope };
