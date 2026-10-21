/** teams 浅映射单测（TEAM-001 §5.1）：mock 确定性约定 + RealProvider 建队/改队/冲突回写分支。 */
import { describe, expect, it } from "vitest";
import { AgentScopeError } from "../client";
import { MockAgentScope } from "../mock";
import { RealProvider } from "../index";
import type { AgentScopeClient } from "../client";
import type { AgentScopeOptions, AsTeam } from "../types";

const opts: AgentScopeOptions = {
  mode: "real",
  baseUrl: "http://as.test",
  username: "u",
  password: "p",
  tenant: "default",
  namespace: "ns",
  timeoutMs: 1000,
};

describe("MockAgentScope teams（确定性约定）", () => {
  it("建队返回 id/version=1,并自动挂 2 条任务", async () => {
    const mock = new MockAgentScope(opts);
    const team = await mock.createTeam({ name: "增长组", leaderAgentId: "agent-1" });
    expect(team.id).toMatch(/^mock-team-/);
    expect(team.version).toBe(1);
    expect(team.leaderAgentId).toBe("agent-1");
    const tasks = await mock.listAgentTasks(team.id);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.status).toBe("active");
  });

  it("改队 version 自增、leader 更新;未知 teamId 404", async () => {
    const mock = new MockAgentScope(opts);
    const team = await mock.createTeam({ name: "A", leaderAgentId: "agent-1" });
    const updated = await mock.updateTeam(team.id, { name: "A2", leaderAgentId: "agent-2" });
    expect(updated.version).toBe(2);
    expect(updated.leaderAgentId).toBe("agent-2");
    await expect(
      mock.updateTeam("no-such", { name: "x", leaderAgentId: "y" }),
    ).rejects.toBeInstanceOf(AgentScopeError);
  });

  it("FAIL: 前缀故障注入(同步失败态演练开关)", async () => {
    const mock = new MockAgentScope(opts);
    await expect(
      mock.createTeam({ name: "FAIL:演练", leaderAgentId: "agent-1" }),
    ).rejects.toThrow(/mock 注入/u);
  });

  it("LOCAL_ONLY 团队无任务(空态口径)", async () => {
    const mock = new MockAgentScope(opts);
    expect(await mock.listAgentTasks("never-created")).toEqual([]);
  });
});

/** 测试造数:手写 client 桩(边界 as 断言,rules/typescript §3.2 允许于测试) */
type TeamInput = { name: string; leaderAgentId: string };
type StubImpl = {
  updateTeam?: (id: string, input: TeamInput) => Promise<AsTeam>;
  createTeam?: (input: TeamInput) => Promise<AsTeam>;
  listTeams?: () => Promise<AsTeam[]>;
};

function stubClient(impl: StubImpl): AgentScopeClient {
  const noop = async (): Promise<AsTeam[]> => [];
  const stub: StubImpl = {
    updateTeam: (async () => {
      throw new Error("stub 未提供 updateTeam");
    }) satisfies StubImpl["updateTeam"],
    createTeam: (async () => {
      throw new Error("stub 未提供 createTeam");
    }) satisfies StubImpl["createTeam"],
    listTeams: noop,
    ...impl,
  };
  return stub as unknown as AgentScopeClient;
}
const asTeam = (id: string, name: string): AsTeam => ({
  id,
  name,
  leaderAgentId: "agent-1",
  version: 1,
});

describe("RealProvider.ensureTeam(建/改/冲突回写分支)", () => {
  const input = { name: "增长组", leaderAgentId: "agent-1" };

  it("asTeamId 非空 → 直接 updateTeam(不新建)", async () => {
    let created = false;
    const p = new RealProvider(
      opts,
      stubClient({
        updateTeam: async () => asTeam("up-1", input.name),
        createTeam: async () => {
          created = true;
          return asTeam("new-1", input.name);
        },
      }),
    );
    const r = await p.ensureTeam({ ...input, asTeamId: "up-1" });
    expect(r).toEqual({ teamId: "up-1", reusedExisting: true });
    expect(created).toBe(false);
  });

  it("上游 404(团队丢失) → 落到建队路径重建", async () => {
    const p = new RealProvider(
      opts,
      stubClient({
        updateTeam: async () => {
          throw new AgentScopeError(404, "{}");
        },
        createTeam: async () => asTeam("new-1", input.name),
      }),
    );
    const r = await p.ensureTeam({ ...input, asTeamId: "lost-1" });
    expect(r).toEqual({ teamId: "new-1", reusedExisting: false });
  });

  it("建队冲突(如同名已存在) → 列表匹配回写关联", async () => {
    const p = new RealProvider(
      opts,
      stubClient({
        createTeam: async () => {
          throw new AgentScopeError(409, "conflict");
        },
        listTeams: async () => [asTeam("exist-1", input.name), asTeam("other", "别队")],
        updateTeam: async (id: string) => asTeam(id, input.name),
      }),
    );
    const r = await p.ensureTeam({ ...input });
    expect(r).toEqual({ teamId: "exist-1", reusedExisting: true });
  });

  it("建队冲突且无同名 → 原错误上抛(sync 层落 asSyncError)", async () => {
    const p = new RealProvider(
      opts,
      stubClient({
        createTeam: async () => {
          throw new AgentScopeError(503, "down");
        },
      }),
    );
    await expect(p.ensureTeam({ ...input })).rejects.toBeInstanceOf(AgentScopeError);
  });
});
