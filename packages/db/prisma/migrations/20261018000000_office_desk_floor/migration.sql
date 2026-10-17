-- AlterTable
ALTER TABLE "digital_employees" ADD COLUMN     "desk_floor" INTEGER,
ADD COLUMN     "desk_seat" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "digital_employees_org_id_desk_floor_desk_seat_key" ON "digital_employees"("org_id", "desk_floor", "desk_seat");
