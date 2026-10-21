-- TEAM-001 AgentScope teams 浅映射：运行面同步列（docs/sprint-team-1/TEAM-001-agentscope-team-sync.md §4.2）
ALTER TABLE "teams" ADD COLUMN "as_synced_at" TIMESTAMPTZ(3);
ALTER TABLE "teams" ADD COLUMN "as_sync_error" VARCHAR(512);
