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
  // 30xxx staff/chat 域（S1 登记；错误码一经发布不改语义，新增不复用）
  STAFF_CODE_DUP: 30101, // 工号冲突
  STAFF_NOT_PUBLISHED: 30102, // 员工未发布（不可发起会话）
  STAFF_STATE_INVALID: 30103, // 员工状态机非法迁移
  RUN_CONFLICT: 30201, // 会话已有进行中的运行（AgentScope 同会话并发 409 对齐）
  // 50xxx 内部与依赖
  INTERNAL: 50000,
  DEGRADED: 50001, // 依赖组件不可用（readiness / AgentScope 不可达）
  AGENTSCOPE_ERROR: 50002, // AgentScope 上游返回错误（蓝图中 503+业务码的细分）
} as const;
