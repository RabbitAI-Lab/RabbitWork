/** team 域纯函数单测（TEAM-001 §5.1）：同步状态派生 + 失败原因归一截断。 */
import { describe, expect, it } from "vitest";
import { deriveSyncState, toSyncErrorText } from "../team-dto";

describe("deriveSyncState（TEAM-001 §2.1 状态机派生）", () => {
  it("有 asSyncError → SYNC_FAILED（建队失败的 asTeamId 空态同样算失败尝试）", () => {
    expect(deriveSyncState({ asTeamId: null, asSyncError: "HTTP 503" })).toBe("SYNC_FAILED");
    expect(deriveSyncState({ asTeamId: "as-1", asSyncError: "x" })).toBe("SYNC_FAILED");
  });
  it("无错误 + 无 asTeamId → LOCAL_ONLY（从未推送）", () => {
    expect(deriveSyncState({ asTeamId: null, asSyncError: null })).toBe("LOCAL_ONLY");
  });
  it("无错误 + asTeamId → SYNCED", () => {
    expect(deriveSyncState({ asTeamId: "as-1", asSyncError: null })).toBe("SYNCED");
  });
});

describe("toSyncErrorText（落库 512 上限）", () => {
  it("Error → message;非 Error 对象 → JSON 字符串", () => {
    expect(toSyncErrorText(new Error("boom"))).toBe("boom");
    expect(toSyncErrorText({ code: 503 })).toBe('{"code":503}');
    expect(toSyncErrorText(42)).toBe("42");
  });
  it("超长截断到 512(as_sync_error 列宽)", () => {
    expect(toSyncErrorText("x".repeat(900)).length).toBe(512);
  });
});
