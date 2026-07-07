-- AlterTable
ALTER TABLE "newsletters" ADD COLUMN     "sentGroups" TEXT[] DEFAULT ARRAY[]::TEXT[];
