-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ORG_ADMIN', 'COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AttackSource" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- CreateEnum
CREATE TYPE "CornerSide" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "CornerType" AS ENUM ('IN', 'OUT', 'SHORT', 'PASS');

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cognito_sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "team_id" UUID,
    "role" "RoleName" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_user_role_scope" CHECK (num_nonnulls("organization_id", "team_id") = 1)
);

-- CreateTable
CREATE TABLE "player" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "external_player_id" TEXT NOT NULL,
    "roster_label" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "jersey_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "opponent_name" TEXT NOT NULL,
    "game_date" DATE,
    "league_type" TEXT,
    "external_game_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_game_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "starter" BOOLEAN,
    "goals_count" INTEGER NOT NULL DEFAULT 0,
    "assists_count" INTEGER NOT NULL DEFAULT 0,
    "total_time_in_game_minutes" INTEGER,
    "on_bench_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_game_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_interval" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_game_log_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "time_in_minute" INTEGER NOT NULL,
    "time_out_minute" INTEGER,

    CONSTRAINT "sub_interval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_game_log_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "position" TEXT,

    CONSTRAINT "goal_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assist_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_game_log_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "position" TEXT,

    CONSTRAINT "assist_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defensive_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID,
    "opponent_name_raw" TEXT NOT NULL,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "minute" INTEGER NOT NULL,
    "goal_against" BOOLEAN NOT NULL,
    "goal_scorer_opponent" TEXT,
    "goalkeeper_id" UUID,
    "left_back_id" UUID,
    "cdm_id" UUID,
    "right_back_id" UUID,
    "defensive_error_player_id" UUID,
    "missed_help_player_id" UUID,
    "defensive_shape" TEXT,
    "attack_source" "AttackSource",
    "goal_type_notes" TEXT,
    "minutes_in_position_before_goal" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defensive_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corner_kick_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID,
    "opponent_name_raw" TEXT NOT NULL,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "minute" INTEGER NOT NULL,
    "side" "CornerSide",
    "taker_id" UUID,
    "type" "CornerType",
    "target_zone" TEXT,
    "outcome" TEXT,
    "shot" BOOLEAN NOT NULL DEFAULT false,
    "goal" BOOLEAN NOT NULL DEFAULT false,
    "receiver_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corner_kick_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_organization_id_name_season_key" ON "team"("organization_id", "name", "season");

-- CreateIndex
CREATE UNIQUE INDEX "user_cognito_sub_key" ON "user"("cognito_sub");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_organization_id_team_id_role_key" ON "user_roles"("user_id", "organization_id", "team_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "player_team_id_external_player_id_key" ON "player"("team_id", "external_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_team_id_external_game_id_key" ON "game"("team_id", "external_game_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_game_log_game_id_player_id_key" ON "player_game_log"("game_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_interval_player_game_log_id_sequence_key" ON "sub_interval"("player_game_log_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "goal_event_player_game_log_id_sequence_key" ON "goal_event"("player_game_log_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "assist_event_player_game_log_id_sequence_key" ON "assist_event"("player_game_log_id", "sequence");

-- CreateIndex
CREATE INDEX "defensive_event_game_id_idx" ON "defensive_event"("game_id");

-- CreateIndex
CREATE INDEX "corner_kick_event_game_id_idx" ON "corner_kick_event"("game_id");

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_log" ADD CONSTRAINT "player_game_log_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_log" ADD CONSTRAINT "player_game_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_interval" ADD CONSTRAINT "sub_interval_player_game_log_id_fkey" FOREIGN KEY ("player_game_log_id") REFERENCES "player_game_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_event" ADD CONSTRAINT "goal_event_player_game_log_id_fkey" FOREIGN KEY ("player_game_log_id") REFERENCES "player_game_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assist_event" ADD CONSTRAINT "assist_event_player_game_log_id_fkey" FOREIGN KEY ("player_game_log_id") REFERENCES "player_game_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defensive_event" ADD CONSTRAINT "defensive_event_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defensive_event" ADD CONSTRAINT "defensive_event_goalkeeper_id_fkey" FOREIGN KEY ("goalkeeper_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defensive_event" ADD CONSTRAINT "defensive_event_left_back_id_fkey" FOREIGN KEY ("left_back_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defensive_event" ADD CONSTRAINT "defensive_event_cdm_id_fkey" FOREIGN KEY ("cdm_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defensive_event" ADD CONSTRAINT "defensive_event_right_back_id_fkey" FOREIGN KEY ("right_back_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defensive_event" ADD CONSTRAINT "defensive_event_defensive_error_player_id_fkey" FOREIGN KEY ("defensive_error_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defensive_event" ADD CONSTRAINT "defensive_event_missed_help_player_id_fkey" FOREIGN KEY ("missed_help_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corner_kick_event" ADD CONSTRAINT "corner_kick_event_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corner_kick_event" ADD CONSTRAINT "corner_kick_event_taker_id_fkey" FOREIGN KEY ("taker_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corner_kick_event" ADD CONSTRAINT "corner_kick_event_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
