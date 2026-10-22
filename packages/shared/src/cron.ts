/** cron 域纯函数（CRON-001 §2.1：5 段标准表达式解析/下次触发/中文摘要）。 */
import { z } from "zod";

export const cronInput = z
  .string()
  .trim()
  .regex(/^[\d*,\-/ ]+$/u, "cron 表达式仅允许数字与 * , - / 空格")
  .refine((v) => v.split(/\s+/u).length === 5, { message: "cron 必须为 5 段（分 时 日 月 周）" })
  .refine((v) => parseCron(v) !== null, { message: "cron 表达式非法（字段越界或语法错误）" });
export type CronInput = z.infer<typeof cronInput>;

/** 各字段（分 时 日 月 周）的合法域上限（周 0-7,0/7 均为周日） */
const FIELD_MAX = [59, 23, 31, 12, 7];

export interface ParsedCron {
  /** 每字段命中的分钟/小时等位集（已归一:周日 7→0） */
  fields: Array<Set<number>>;
}

/** 解析 5 段 cron;非法返回 null（纯函数,单测锚点）。 */
export function parseCron(expr: string): ParsedCron | null {
  const parts = expr.trim().split(/\s+/u);
  if (parts.length !== 5) return null;
  const fields: Array<Set<number>> = [];
  for (let i = 0; i < 5; i++) {
    const max = FIELD_MAX[i]!;
    const min = i === 4 ? 0 : i === 2 ? 1 : i === 3 ? 1 : 0;
    const set = new Set<number>();
    for (const token of parts[i]!.split(",")) {
      const parsed = parseToken(token, min, max);
      if (parsed === null) return null;
      for (const v of parsed) set.add(i === 4 && v === 7 ? 0 : v);
    }
    if (set.size === 0) return null;
    fields.push(set);
  }
  return { fields };
}

function parseToken(token: string, min: number, max: number): number[] | null {
  // 形态：* | * /step | a | a-b | a-b/step | a/s（s 视为 a 起 step）
  const m = token.match(/^(?:(\*|\d+-\d+|\d+)(?:\/(\d+))?)$/u);
  if (!m) return null;
  const step = m[2] ? Number(m[2]) : 1;
  if (step <= 0) return null;
  let lo: number;
  let hi: number;
  if (m[1] === "*") {
    lo = min;
    hi = max;
  } else if (m[1]!.includes("-")) {
    const [a, b] = m[1]!.split("-");
    lo = Number(a);
    hi = Number(b);
    if (lo > hi) return null;
  } else {
    lo = Number(m[1]);
    hi = m[2] ? max : lo; // a/step 语义：a 到 max 每 step
  }
  if (lo < min || hi > max) return null;
  const out: number[] = [];
  for (let v = lo; v <= hi; v += step) out.push(v);
  return out;
}

/**
 * 下次触发时间（分钟粒度;from 之后第一个命中时刻）。366 天无命中返回 null（如 2 月 30 日）。
 */
export function nextRunAt(expr: string, from: Date): Date | null {
  const cron = parseCron(expr);
  if (!cron) return null;
  const [min, hour, dom, mon, dow] = cron.fields;
  // 从 from+1 分钟的整分开始逐分钟扫描（上限 366*24*60 分钟）
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      min!.has(cursor.getMinutes()) &&
      hour!.has(cursor.getHours()) &&
      dom!.has(cursor.getDate()) &&
      mon!.has(cursor.getMonth() + 1) &&
      dow!.has(cursor.getDay())
    ) {
      return new Date(cursor);
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

/** 常见模式中文摘要（未匹配回退表达式原文） */
export function describeCron(expr: string): string {
  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/u);
  if (m === undefined) return expr;
  const hh = h === undefined ? "00" : String(Number(h)).padStart(2, "0");
  if (dom === "*" && mon === "*" && dow === "*") {
    if (m === "*") return "每分钟";
    if (m === "0") return `每天 ${hh || "00"}:00`;
    if (m!.startsWith("*/")) return `每 ${m!.slice(2)} 分钟`;
  }
  if (dow === "1-5" && dom === "*" && m === "0") return `每个工作日 ${hh || "00"}:00`;
  if (dow === "0" && dom === "*" && m === "0") return `每周日 ${hh || "00"}:00`;
  if (dow === "1" && dom === "*" && m === "0") return `每周一 ${hh || "00"}:00`;
  return expr;
}
