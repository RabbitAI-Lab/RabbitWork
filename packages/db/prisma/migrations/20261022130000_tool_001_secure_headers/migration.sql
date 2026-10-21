-- TOOL-001 工具域首份规格补齐敏感头加密列（docs/sprint-tool-1/TOOL-001-http-tool.md §4）
ALTER TABLE "tool_definitions" ADD COLUMN "secure_headers" TEXT;
