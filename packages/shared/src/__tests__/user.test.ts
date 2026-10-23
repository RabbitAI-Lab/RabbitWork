/** user 域 zod round-trip + 密码生成（SYS-002 §5）。 */
import { describe, expect, it } from "vitest";
import { generatePassword, userCreateInput, userUpdateInput } from "../user";

describe("userCreateInput（SYS-002）", () => {
  it("合法:email 归一小写/角色默认 MEMBER/密码可选", () => {
    const r = userCreateInput.parse({ email: "Zhang@Company.COM", name: "张三" });
    expect(r.email).toBe("zhang@company.com");
    expect(r.role).toBe("MEMBER");
  });
  it("非法:邮箱格式/密码过短/角色白名单外", () => {
    expect(userCreateInput.safeParse({ email: "not-email", name: "x" }).success).toBe(false);
    expect(
      userCreateInput.safeParse({ email: "a@b.com", name: "x", password: "short" }).success,
    ).toBe(false);
    expect(userCreateInput.safeParse({ email: "a@b.com", name: "x", role: "OWNER" }).success).toBe(
      false,
    );
  });
  it("update 部分字段", () => {
    expect(userUpdateInput.parse({ status: "DISABLED" }).status).toBe("DISABLED");
  });
});

describe("generatePassword（12 位,无易混淆字符）", () => {
  it("长度 12,字符集受限,两次不同", () => {
    const p = generatePassword();
    expect(p).toHaveLength(12);
    expect(p).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]+$/u);
    expect(generatePassword()).not.toBe(p);
  });
});
