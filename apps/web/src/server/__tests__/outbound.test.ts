/** 出站守卫纯函数单测（TOOL-001 §5：SSRF 矩阵）+ tool zod/渲染单测。 */
import { describe, expect, it } from "vitest";
import { ipInCidr, isAllowedEgress, isPrivateIp } from "../outbound";
import { isSensitiveHeader, renderTemplate, toolCreateInput } from "@rabbit/shared";

describe("ipInCidr（CIDR 前缀匹配）", () => {
  it("v4 命中/不命中/跨族", () => {
    expect(ipInCidr("192.168.3.10", "192.168.0.0/16")).toBe(true);
    expect(ipInCidr("172.31.255.1", "172.16.0.0/12")).toBe(true);
    expect(ipInCidr("172.32.0.1", "172.16.0.0/12")).toBe(false);
    expect(ipInCidr("8.8.8.8", "192.168.0.0/16")).toBe(false);
    expect(ipInCidr("::1", "192.168.0.0/16")).toBe(false); // 跨族
  });
  it("v6 与非 8 整数位前缀", () => {
    expect(ipInCidr("fe80::1", "fe80::/10")).toBe(true);
    expect(ipInCidr("2001:db8::1", "fe80::/10")).toBe(false);
    expect(ipInCidr("10.1.2.3", "10.0.0.0/8")).toBe(true);
  });
});

describe("isPrivateIp（默认拒绝清单）", () => {
  it("私网/环回/链路本地/组播全拒", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.10",
      "169.254.1.1",
      "0.0.0.0",
      "224.0.0.1",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("公网放行;v6 环回/ULA/链路本地拒;v4-mapped 折回判定", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("isAllowedEgress（白名单放行矩阵）", () => {
  it("公网恒通;私网默认拒;白名单 CIDR 放行;白名单外仍拒", () => {
    expect(isAllowedEgress("8.8.8.8", [])).toBe(true);
    expect(isAllowedEgress("127.0.0.1", [])).toBe(false);
    expect(isAllowedEgress("127.0.0.1", ["127.0.0.0/8"])).toBe(true);
    expect(isAllowedEgress("192.168.1.5", ["127.0.0.0/8"])).toBe(false);
    expect(isAllowedEgress("192.168.1.5", ["192.168.0.0/16"])).toBe(true);
    expect(isAllowedEgress("::ffff:127.0.0.1", ["127.0.0.1/8"])).toBe(true); // v4-mapped 归一
  });
});

describe("renderTemplate / isSensitiveHeader / toolCreateInput", () => {
  it("占位渲染 + 未识别占位符报错 + 参数值编码", () => {
    expect(renderTemplate("https://a.com/fx?c={{币种}}", { 币种: "USD" })).toBe(
      "https://a.com/fx?c=USD",
    );
    expect(renderTemplate("https://a.com/fx?c={{币种}}", { 币种: "人 民币" })).toBe(
      "https://a.com/fx?c=%E4%BA%BA%20%E6%B0%91%E5%B8%81",
    );
    expect(() => renderTemplate("{{缺}}", {})).toThrow(/未识别的占位符/u);
  });
  it("敏感头判定关键字", () => {
    expect(isSensitiveHeader("Authorization")).toBe(true);
    expect(isSensitiveHeader("X-Api-Key")).toBe(true);
    expect(isSensitiveHeader("X-Token")).toBe(true);
    expect(isSensitiveHeader("Content-Type")).toBe(false);
  });
  it("toolCreateInput:合法默认 + 非 http(s)/空名拒绝", () => {
    const r = toolCreateInput.parse({ name: "汇率", url: "https://a.com" });
    expect(r.method).toBe("GET");
    expect(r.headers).toEqual({});
    expect(toolCreateInput.safeParse({ name: "x", url: "ftp://a.com" }).success).toBe(false);
    expect(toolCreateInput.safeParse({ name: "", url: "https://a.com" }).success).toBe(false);
  });
});
