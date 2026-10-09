#!/usr/bin/env node
/** rabbit-env 端口表唯一性测试（CI `pnpm test` 守住：rules/git-workflow §9 禁硬编码端口的事实源）。 */
import assert from "node:assert/strict";
import test from "node:test";
import { MAX_SLOT, resolveSlot, rabbitEnv } from "./rabbit-env.mjs";

test("槽位推导：RABBIT_SLOT 显式优先", () => {
  assert.equal(resolveSlot("/anywhere", { RABBIT_SLOT: "3" }), 3);
});

test("槽位推导：worktree 目录名 RabbitWork-s{N}", () => {
  assert.equal(resolveSlot("/x/RabbitWork-s7"), 7);
  assert.equal(resolveSlot("/x/RabbitWork-s3", { RABBIT_SLOT: "5" }), 5);
});

test("槽位推导：主仓/未知目录 → 0；越界报错", () => {
  assert.equal(resolveSlot("/Volumes/MoerSSD/Dev/RabbitWork"), 0);
  assert.throws(() => resolveSlot("/anywhere", { RABBIT_SLOT: "10" }));
  assert.throws(() => resolveSlot("/x/RabbitWork-s10"));
});

test("端口表：全槽位带偏移端口（web/mock/runner/pg）两两唯一（跨栈不撞）", () => {
  // Redis 实例端口（dev 6390 / e2e+jm 6391）为同栈共享设计：隔离靠逻辑库号 = slot，不参与唯一性
  const seen = new Map();
  for (let s = 0; s <= MAX_SLOT; s++) {
    const e = rabbitEnv(s);
    for (const [stack, ports] of [
      ["dev", [e.dev.webPort, e.dev.mockPort, e.dev.runnerPort, e.dev.pgPort]],
      ["e2e", [e.e2e.webPort, e.e2e.mockPort, e.e2e.runnerPort, e.e2e.pgPort]],
      ["jm", [e.jm.webPort, e.jm.mockPort, e.jm.runnerPort, e.jm.pgPort]],
    ]) {
      for (const p of ports) {
        const key = `${p}`;
        assert.ok(!seen.has(key), `端口 ${p} 重复：${stack}/s${s} 与 ${seen.get(key)}`);
        seen.set(key, `${stack}/s${s}`);
      }
    }
  }
  // 逻辑库号 = slot（0-9）在 Redis 16 库上限内
  for (let s = 0; s <= MAX_SLOT; s++) {
    assert.ok(Number(new URL(rabbitEnv(s).dev.redisUrl).pathname.slice(1)) <= 15);
  }
});

test("端口表：与 RabbitAITest 基址系（3000/3100/3200/4000/4100/4200/4300/5440/5450/5460/6379/6381）零交叠", () => {
  // 同机两项目 worktree 并行互不冲突（rabbit-env.mjs 头注释的硬约束）
  const theirs = new Set();
  for (let s = 0; s <= 9; s++) {
    for (const base of [3000, 3100, 3200, 4000, 4100, 4200, 4300, 4310, 4320, 5440, 5450, 5460]) {
      theirs.add(base + s);
    }
  }
  theirs.add(6379);
  theirs.add(6381);
  for (let s = 0; s <= MAX_SLOT; s++) {
    const e = rabbitEnv(s);
    for (const p of [
      e.dev.webPort,
      e.dev.mockPort,
      e.dev.runnerPort,
      e.dev.pgPort,
      e.dev.redisPort,
      e.e2e.webPort,
      e.e2e.mockPort,
      e.e2e.runnerPort,
      e.e2e.pgPort,
      e.e2e.redisPort,
      e.jm.webPort,
      e.jm.mockPort,
      e.jm.runnerPort,
      e.jm.pgPort,
      e.jm.redisPort,
    ]) {
      assert.ok(!theirs.has(p), `端口 ${p}（slot ${s}）与 RabbitAITest 端口表交叠`);
    }
  }
});
