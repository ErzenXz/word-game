/*
  Warnings:

  - You are about to drop the `_LeaderboardToRoom` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_LeaderboardToTheme` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `playerId` to the `Leaderboard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `themeId` to the `Leaderboard` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_id_fkey";

-- DropForeignKey
ALTER TABLE "_LeaderboardToRoom" DROP CONSTRAINT "_LeaderboardToRoom_A_fkey";

-- DropForeignKey
ALTER TABLE "_LeaderboardToRoom" DROP CONSTRAINT "_LeaderboardToRoom_B_fkey";

-- DropForeignKey
ALTER TABLE "_LeaderboardToTheme" DROP CONSTRAINT "_LeaderboardToTheme_A_fkey";

-- DropForeignKey
ALTER TABLE "_LeaderboardToTheme" DROP CONSTRAINT "_LeaderboardToTheme_B_fkey";

-- AlterTable
ALTER TABLE "Leaderboard" ADD COLUMN     "playerId" INTEGER NOT NULL,
ADD COLUMN     "themeId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RoomChat" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "_LeaderboardToRoom";

-- DropTable
DROP TABLE "_LeaderboardToTheme";

-- AddForeignKey
ALTER TABLE "Leaderboard" ADD CONSTRAINT "Leaderboard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leaderboard" ADD CONSTRAINT "Leaderboard_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
