/** team 域 schema round-trip（TEAM-001；rules/testing §4.2 合法/非法样例）。 */
import { describe, expect, it } from "vitest";
import { teamCreateInput, teamDto, teamTasksResultDto, teamUpdateInput } from "../team";

describe("teamCreateInput（TEAM-001：leaderEmployeeId + syncToRuntime）", () => {
  it("合法:基础字段 + 可选同步参数", () => {
    const r = teamCreateInput.parse({
      name: "增长组",
      description: "desc",
      goal: "goal",
      leaderEmployeeId: "emp-1",
      syncToRuntime: true,
    });
    expect(r.syncToRuntime).toBe(true);
    expect(r.leaderEmployeeId).toBe("emp-1");
  });

  it("合法:仅必填字段(同步参数缺省——路由按默认 true 处理)", () => {
    const r = teamCreateInput.parse({ name: "增长组" });
    expect(r.syncToRuntime).toBeUndefined();
    expect(r.leaderEmployeeId).toBeUndefined();
  });

  it("非法:空名/超长名/syncToRuntime 非布尔", () => {
    expect(teamCreateInput.safeParse({ name: "" }).success).toBe(false);
    expect(teamCreateInput.safeParse({ name: "x".repeat(129) }).success).toBe(false);
    expect(teamCreateInput.safeParse({ name: "ok", syncToRuntime: "yes" }).success).toBe(false);
  });
});

describe("teamUpdateInput（不含同步参数——改名自动触发同步）", () => {
  it("合法:部分字段", () => {
    expect(teamUpdateInput.parse({ goal: "g" }).goal).toBe("g");
  });
  it("syncToRuntime 不在 update schema(zod 默认剥离未知键)", () => {
    const r = teamUpdateInput.parse({ name: "n", syncToRuntime: true });
    expect(r).not.toHaveProperty("syncToRuntime");
  });
});

describe("teamDto / teamTasksResultDto（运行面字段）", () => {
  it("syncState 三态枚举 + 可空映射字段 round-trip", () => {
    const base = {
      id: "t1",
      name: "n",
      description: null,
      goal: null,
      status: "ACTIVE",
      memberCount: 1,
      leaderName: null,
      asTeamId: null,
      asSyncedAt: null,
      asSyncError: null,
      syncState: "LOCAL_ONLY",
      createdAt: "2026-10-21T00:00:00Z",
      updatedAt: "2026-10-21T00:00:00Z",
    };
    expect(teamDto.parse(base).syncState).toBe("LOCAL_ONLY");
    expect(
      teamDto.parse({ ...base, syncState: "SYNC_FAILED", asSyncError: "HTTP 503" }).asSyncError,
    ).toBe("HTTP 503");
    expect(teamDto.safeParse({ ...base, syncState: "BAD" }).success).toBe(false);
  });

  it("teamTasksResultDto:degraded 标志 + 空字段容忍(R-TASK-SHAPE)", () => {
    const r = teamTasksResultDto.parse({
      items: [{ id: "a", title: null, status: null, assignee: null, updatedAt: null }],
      degraded: true,
    });
    expect(r.degraded).toBe(true);
    expect(r.items[0]?.title).toBeNull();
  });
});
