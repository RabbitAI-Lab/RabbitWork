/** 响应信封与错误（api-conventions §2/§3）。 */
export interface Envelope<T> {
  code: number;
  message: string;
  data: T | null;
}

export class DomainError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function ok<T>(data: T): Envelope<T> {
  return { code: 0, message: "ok", data };
}

export function fail(code: number, message: string): Envelope<null> {
  return { code, message, data: null };
}

/**
 * 错误码分段（api-conventions §3；错误码一经发布不改语义，新增不复用）。
 * 域分段（30xxx 起）随首个域规格评审登记，本处只保留通用横切码。
 */
export const ErrCode = {
  // 10xxx 系统与认证
  UNAUTHENTICATED: 10001,
  FORBIDDEN: 10003, // 无权限点（rbac §4）
  NOT_FOUND: 10404, // 资源不存在或不属于当前作用域（防枚举，与 403 区分）
  VALIDATION_FAILED: 10422, // zod 校验拒绝
  // 50xxx 内部与依赖
  INTERNAL: 50000,
  DEGRADED: 50001, // 依赖组件不可用（readiness）
} as const;
