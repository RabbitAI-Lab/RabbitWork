-- CHAT-003 hitl 域首份规格补齐结论列（docs/sprint-chat-3/CHAT-003-hitl-handoff.md §4）
ALTER TABLE "human_handoff_records" ADD COLUMN "conclusion" VARCHAR(1024);
