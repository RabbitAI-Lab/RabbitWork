-- MODEL-001 模型域首份规格一次建齐（docs/sprint-model-1/MODEL-001-model-config.md §4）
CREATE TABLE "model_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "protocol" VARCHAR(48) NOT NULL,
    "base_url" VARCHAR(512) NOT NULL,
    "model_id" VARCHAR(128) NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_error" TEXT,
    "last_verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "model_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "model_configs_org_id_name_key" ON "model_configs"("org_id", "name");
CREATE INDEX "model_configs_org_id_deleted_at_idx" ON "model_configs"("org_id", "deleted_at");
