-- KNW-001 知识域首份规格补齐切片表（docs/sprint-knw-1/KNW-001-kb-retrieval.md §4.1）
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "base_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "knowledge_chunks_base_id_idx" ON "knowledge_chunks"("base_id");
CREATE INDEX "knowledge_chunks_document_id_seq_idx" ON "knowledge_chunks"("document_id", "seq");
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
