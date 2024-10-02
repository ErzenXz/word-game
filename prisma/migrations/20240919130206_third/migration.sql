/*
  Warnings:

  - You are about to drop the `Word` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `score` to the `Player` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Word" DROP CONSTRAINT "Word_themeId_fkey";

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "score" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "code" TEXT NOT NULL;

-- DropTable
DROP TABLE "Word";

-- CreateTable
CREATE TABLE "RoomChat" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "RoomChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leaderboard" (
    "id" SERIAL NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LeaderboardToTheme" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_LeaderboardToRoom" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_LeaderboardToTheme_AB_unique" ON "_LeaderboardToTheme"("A", "B");

-- CreateIndex
CREATE INDEX "_LeaderboardToTheme_B_index" ON "_LeaderboardToTheme"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_LeaderboardToRoom_AB_unique" ON "_LeaderboardToRoom"("A", "B");

-- CreateIndex
CREATE INDEX "_LeaderboardToRoom_B_index" ON "_LeaderboardToRoom"("B");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_id_fkey" FOREIGN KEY ("id") REFERENCES "Leaderboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChat" ADD CONSTRAINT "RoomChat_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeaderboardToTheme" ADD CONSTRAINT "_LeaderboardToTheme_A_fkey" FOREIGN KEY ("A") REFERENCES "Leaderboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeaderboardToTheme" ADD CONSTRAINT "_LeaderboardToTheme_B_fkey" FOREIGN KEY ("B") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeaderboardToRoom" ADD CONSTRAINT "_LeaderboardToRoom_A_fkey" FOREIGN KEY ("A") REFERENCES "Leaderboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LeaderboardToRoom" ADD CONSTRAINT "_LeaderboardToRoom_B_fkey" FOREIGN KEY ("B") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
