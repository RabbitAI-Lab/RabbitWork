-- CHNL-001 渠道域首份规格一次建齐（docs/sprint-chnl-1/CHNL-001-im-channels.md §4）
CREATE TABLE "channel_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "employee_id" TEXT NOT NULL,
    "token_hash" VARCHAR(256) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_message_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "channel_configs_org_id_name_key" ON "channel_configs"("org_id", "name");
CREATE INDEX "channel_configs_org_id_deleted_at_idx" ON "channel_configs"("org_id", "deleted_at");
