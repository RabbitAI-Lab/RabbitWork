import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { DomainError, ErrCode, fail, ok } from "../envelope";
import { isValidPermission, PERMISSIONS } from "../permissions";

describe("envelope", () => {
  it("ok 信封：code=0 且透传 data", () => {
    expect(ok({ a: 1 })).toEqual({ code: 0, message: "ok", data: { a: 1 } });
  });

  it("fail 信封：data 恒为 null", () => {
    expect(fail(ErrCode.NOT_FOUND, "无权访问")).toEqual({
      code: 10404,
      message: "无权访问",
      data: null,
    });
  });

  it("DomainError 携带业务码（禁止裸 throw Error 表达业务失败）", () => {
    const e = new DomainError(ErrCode.FORBIDDEN, "无权限点");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe(10003);
    assert.ok(e.name === "DomainError");
  });
});

describe("permissions", () => {
  it("登记的权限点全部符合命名格式", () => {
    for (const p of PERMISSIONS) {
      expect(isValidPermission(p), p).toBe(true);
    }
  });

  it("非法格式拒绝", () => {
    expect(isValidPermission("case:read")).toBe(false);
    expect(isValidPermission("PROJECT_CASE:UPSERT")).toBe(false);
    expect(isValidPermission("SYSTEM_USER:READ ")).toBe(false);
  });
});
