-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" VARCHAR(32) NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "digital_employees" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "persona_prompt" TEXT NOT NULL,
    "boundary" TEXT,
    "avatar_url" VARCHAR(512),
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "visibility" VARCHAR(32) NOT NULL DEFAULT 'PRIVATE',
    "creator_id" TEXT,
    "as_agent_id" VARCHAR(64),
    "as_namespace" VARCHAR(128),
    "as_agent_key" VARCHAR(128),
    "as_version" INTEGER,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "digital_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_versions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "assembly_json" JSONB NOT NULL,
    "prompt_compiled" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_model_bindings" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role" VARCHAR(32) NOT NULL,
    "model_ref" VARCHAR(256) NOT NULL,
    "config_json" JSONB,
    "fingerprint" VARCHAR(128),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_model_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_resource_bindings" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "resource_type" VARCHAR(32) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "capability_scope" VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    "params_json" JSONB,
    "as_ref" VARCHAR(256),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_resource_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "origin" VARCHAR(32) NOT NULL DEFAULT 'WEB',
    "origin_ref" VARCHAR(128),
    "as_chat_id" VARCHAR(64),
    "as_session_id" VARCHAR(64),
    "as_runtime_session_id" VARCHAR(64),
    "as_event_stream_url" VARCHAR(512),
    "as_events_url" VARCHAR(512),
    "last_message_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_mirrors" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "as_msg_id" VARCHAR(64),
    "token_usage" JSONB,
    "event_meta" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_mirrors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_records" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "as_run_id" VARCHAR(64),
    "as_turn_id" VARCHAR(64),
    "status" VARCHAR(32) NOT NULL DEFAULT 'STARTED',
    "event_summary_json" JSONB,
    "duration_ms" INTEGER,
    "token_in" INTEGER,
    "token_out" INTEGER,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "run_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_feedback" (
    "id" TEXT NOT NULL,
    "message_mirror_id" TEXT NOT NULL,
    "rating" VARCHAR(16) NOT NULL,
    "comment" VARCHAR(1024),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" VARCHAR(128) NOT NULL,
    "target_type" VARCHAR(64),
    "target_id" VARCHAR(64),
    "reqId" VARCHAR(64),
    "latency_ms" INTEGER,
    "status_code" INTEGER,
    "detail_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_dailies" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "token_in" INTEGER NOT NULL DEFAULT 0,
    "token_out" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_dailies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "as_ref" VARCHAR(256),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "source_url" VARCHAR(512),
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "as_doc_id" VARCHAR(64),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_ingest_jobs" (
    "id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "document_id" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_ingest_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_definitions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "kind" VARCHAR(32) NOT NULL DEFAULT 'PROMPT',
    "prompt_template" TEXT,
    "sop_graph" JSONB,
    "variables_schema" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "skill_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_definitions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "method" VARCHAR(16) NOT NULL DEFAULT 'GET',
    "url" VARCHAR(512) NOT NULL,
    "headers_json" JSONB,
    "input_schema" JSONB,
    "output_schema" JSONB,
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tool_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_server_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "transport" VARCHAR(32) NOT NULL,
    "endpoint" VARCHAR(512) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "mcp_server_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "cron" VARCHAR(64) NOT NULL,
    "input_template" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "as_automation_id" VARCHAR(64),
    "last_run_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_task_runs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "output" JSONB,

    CONSTRAINT "scheduled_task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "scope" VARCHAR(32) NOT NULL,
    "staff_id" TEXT,
    "key_prefix" VARCHAR(32) NOT NULL,
    "pepper_hash" VARCHAR(256) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "human_handoff_records" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "initiated_by" VARCHAR(64),
    "handled_by" VARCHAR(64),
    "reason" VARCHAR(512),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_handoff_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "digital_employees_org_id_deleted_at_idx" ON "digital_employees"("org_id", "deleted_at");

-- CreateIndex
CREATE INDEX "digital_employees_status_idx" ON "digital_employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "digital_employees_org_id_code_key" ON "digital_employees"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_versions_employee_id_version_key" ON "employee_versions"("employee_id", "version");

-- CreateIndex
CREATE INDEX "employee_model_bindings_employee_id_idx" ON "employee_model_bindings"("employee_id");

-- CreateIndex
CREATE INDEX "employee_resource_bindings_employee_id_resource_type_idx" ON "employee_resource_bindings"("employee_id", "resource_type");

-- CreateIndex
CREATE INDEX "conversations_org_id_user_id_deleted_at_idx" ON "conversations"("org_id", "user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "conversations_employee_id_idx" ON "conversations"("employee_id");

-- CreateIndex
CREATE INDEX "message_mirrors_conversation_id_idx" ON "message_mirrors"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_mirrors_conversation_id_seq_key" ON "message_mirrors"("conversation_id", "seq");

-- CreateIndex
CREATE INDEX "run_records_conversation_id_status_idx" ON "run_records"("conversation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "message_feedback_message_mirror_id_key" ON "message_feedback"("message_mirror_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "usage_dailies_org_id_day_idx" ON "usage_dailies"("org_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "usage_dailies_employee_id_day_key" ON "usage_dailies"("employee_id", "day");

-- CreateIndex
CREATE INDEX "knowledge_bases_org_id_deleted_at_idx" ON "knowledge_bases"("org_id", "deleted_at");

-- CreateIndex
CREATE INDEX "knowledge_documents_base_id_status_idx" ON "knowledge_documents"("base_id", "status");

-- CreateIndex
CREATE INDEX "knowledge_ingest_jobs_base_id_status_idx" ON "knowledge_ingest_jobs"("base_id", "status");

-- CreateIndex
CREATE INDEX "skill_definitions_org_id_deleted_at_idx" ON "skill_definitions"("org_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "skill_definitions_org_id_name_key" ON "skill_definitions"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tool_definitions_org_id_name_key" ON "tool_definitions"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_server_configs_org_id_name_key" ON "mcp_server_configs"("org_id", "name");

-- CreateIndex
CREATE INDEX "scheduled_tasks_org_id_deleted_at_idx" ON "scheduled_tasks"("org_id", "deleted_at");

-- CreateIndex
CREATE INDEX "scheduled_task_runs_task_id_status_idx" ON "scheduled_task_runs"("task_id", "status");

-- CreateIndex
CREATE INDEX "api_keys_org_id_idx" ON "api_keys"("org_id");

-- CreateIndex
CREATE INDEX "human_handoff_records_conversation_id_status_idx" ON "human_handoff_records"("conversation_id", "status");

-- AddForeignKey
ALTER TABLE "digital_employees" ADD CONSTRAINT "digital_employees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_employees" ADD CONSTRAINT "digital_employees_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_versions" ADD CONSTRAINT "employee_versions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "digital_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_model_bindings" ADD CONSTRAINT "employee_model_bindings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "digital_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_resource_bindings" ADD CONSTRAINT "employee_resource_bindings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "digital_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "digital_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_mirrors" ADD CONSTRAINT "message_mirrors_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_records" ADD CONSTRAINT "run_records_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_mirror_id_fkey" FOREIGN KEY ("message_mirror_id") REFERENCES "message_mirrors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_ingest_jobs" ADD CONSTRAINT "knowledge_ingest_jobs_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_task_runs" ADD CONSTRAINT "scheduled_task_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
