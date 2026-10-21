/**
 * 平台侧出站守卫（TOOL-001 §4；rules/security §3.4/§8.6-①）：
 * dispatcher 工厂形态——禁「导出函数直接以自身参数调 fetch」的薄包装（会被判 SSRF 入口）；
 * 调用方模块级一次性构造实例后 fetch(url, { dispatcher })。
 * env 豁免在模块初始化时消化成常量,不进入 fetch 调用表达式（§8.6-②）。
 */
import { Agent } from "undici";
import { lookup } from "node:dns/promises";

// ───── 纯函数（单测锚点） ─────

/** CIDR 前缀匹配（支持 v4/v4 与 v6/v6；跨族恒 false） */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  if (!base) return false;
  const bits = bitsRaw ? Number(bitsRaw) : ip.includes(":") ? 128 : 32;
  const a = parseIp(ip);
  const b = parseIp(base);
  if (!a || !b || a.length !== b.length) return false;
  const fullBits = a.length * 8;
  if (bits < 0 || bits > fullBits) return false;
  const byteLen = Math.floor(bits / 8);
  for (let i = 0; i < byteLen; i++) if (a[i] !== b[i]) return false;
  const rem = bits % 8;
  if (rem === 0) return true;
  return (a[byteLen]! >> (8 - rem)) === (b[byteLen]! >> (8 - rem));
}

/** 私网/保留地址判定（TOOL-001 §2.2：默认拒绝清单） */
export function isPrivateIp(ip: string): boolean {
  const v4Ranges = [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "100.64.0.0/10",
    "224.0.0.0/4",
    "240.0.0.0/4",
  ];
  const v6Ranges = ["::1/128", "fc00::/7", "fe80::/10", "::/128"];
  if (ip.includes(":")) {
    // v4-mapped v6（::ffff:10.0.0.1）折回 v4 判定
    const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/iu);
    if (m) return isPrivateIp(m[1]!);
    return v6Ranges.some((c) => ipInCidr(ip.toLowerCase(), c));
  }
  return v4Ranges.some((c) => ipInCidr(ip, c));
}

function parseIp(ip: string): Uint8Array | null {
  if (ip.includes(":")) return parseV6(ip);
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => Number(p));
  if (bytes.some((b) => Number.isNaN(b) || b < 0 || b > 255)) return null;
  return new Uint8Array(bytes);
}

function parseV6(ip: string): Uint8Array | null {
  // 展开 :: 缩写（不处理 zone id/%scope）
  const [head] = ip.split("%");
  const clean = head!.toLowerCase();
  const halves = clean.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves[1] !== undefined ? (halves[1] ? halves[1].split(":").filter(Boolean) : []) : null;
  const groups: number[] = [];
  const pushGroup = (g: string) => {
    // v4 尾段（::ffff:1.2.3.4）
    if (g.includes(".")) {
      const v4 = parseIp(g);
      if (!v4) throw new Error("bad v4");
      groups.push((v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!);
      return;
    }
    const n = Number.parseInt(g, 16);
    if (Number.isNaN(n)) throw new Error("bad group");
    groups.push(n);
  };
  try {
    left.forEach(pushGroup);
    if (right === null) {
      if (groups.length !== 8) return null;
    } else {
      right.forEach(pushGroup);
      const missing = 8 - groups.length;
      if (missing < 0) return null;
      const full = [...groups.slice(0, left.length), ...new Array(missing).fill(0), ...groups.slice(left.length)];
      full.forEach(() => {});
      return writeV6(full);
    }
  } catch {
    return null;
  }
  return writeV6(groups);
}

function writeV6(groups: number[]): Uint8Array | null {
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  groups.forEach((g, i) => {
    out[i * 2] = g >> 8;
    out[i * 2 + 1] = g & 0xff;
  });
  return out;
}

/** 校验单个地址：默认拒绝私网,白名单 CIDR 可放行 */
export function isAllowedEgress(ip: string, allowlist: readonly string[]): boolean {
  if (!isPrivateIp(ip)) return true;
  return allowlist.some((c) => ipInCidr(ip, c));
}

// ───── dispatcher 工厂（§8.6-①形态） ─────

/**
 * 构造带出站守卫的 undici Agent：连接期 DNS 解析钉扎（防重绑定）——
 * 解析 hostname → 全部地址过白名单校验 → 以首个校验通过 IP 直连。
 */
export function createOutboundDispatcher(allowlist: readonly string[]): Agent {
  return new Agent({
    connect: {
      lookup: (
        hostname: string,
        opts: unknown,
        callback: (err: Error | null, addresses: Array<{ address: string; family: number }>) => void,
      ) => {
        void (async () => {
          try {
            const res = await lookup(hostname, { all: true });
            const allowed = res.filter((r) => isAllowedEgress(r.address, allowlist));
            if (allowed.length === 0) {
              const first = res[0]?.address ?? hostname;
              callback(
                new Error(
                  `${first} 为私网/保留地址,已被出站守卫拒绝（TOOL_SSRF_ALLOWLIST 可配置放行）`,
                ),
                [],
              );
              return;
            }
            // 解析钉扎：只放行校验通过的地址（重绑定防护——连接将使用此处地址）
            callback(null, allowed.map((r) => ({ address: r.address, family: r.family })));
          } catch (e) {
            callback(e instanceof Error ? e : new Error(String(e)), []);
          }
        })();
      },
    },
  });
}

/** TOOL-001 试运行专用：模块级单例（env 在初始化时消化,§8.6-②） */
const TOOL_ALLOWLIST_RAW = process.env.TOOL_SSRF_ALLOWLIST ?? "";
export const toolOutboundDispatcher: Agent = createOutboundDispatcher(
  TOOL_ALLOWLIST_RAW
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
);
