import { prisma } from '../lib/prisma';

/** Mirrors the workbook's "Defensive Metrics" side panel: goals conceded, broken out by attack source. */
export async function computeDefensiveMetrics(teamId: string) {
  const events = await prisma.defensiveEvent.findMany({
    where: { game: { teamId } },
    select: { attackSource: true, goalAgainst: true },
  });

  const totalsBySource = new Map<string, { total: number; goals: number }>();
  let totalGoalsConceded = 0;

  for (const e of events) {
    if (e.goalAgainst) totalGoalsConceded++;
    if (!e.attackSource) continue;
    const bucket = totalsBySource.get(e.attackSource) ?? { total: 0, goals: 0 };
    bucket.total += 1;
    if (e.goalAgainst) bucket.goals += 1;
    totalsBySource.set(e.attackSource, bucket);
  }

  const byAttackSource = [...totalsBySource.entries()].map(([attackSource, { total, goals }]) => ({
    attackSource,
    totalEvents: total,
    goalsConceded: goals,
    goalRatio: total > 0 ? goals / total : 0,
    accuracy: total > 0 ? (total - goals) / total : 0,
  }));

  return {
    totalEvents: events.length,
    totalGoalsConceded,
    byAttackSource,
  };
}

/** Mirrors the workbook's Corner-Kick "Key Metrics" panel. */
export async function computeCornerKickMetrics(teamId: string) {
  const events = await prisma.cornerKickEvent.findMany({
    where: { game: { teamId } },
    select: { shot: true, goal: true },
  });

  const totalCorners = events.length;
  const shots = events.filter((e) => e.shot).length;
  const goals = events.filter((e) => e.goal).length;

  return {
    totalCorners,
    shots,
    goals,
    shotsPct: totalCorners > 0 ? shots / totalCorners : 0,
    goalConversionPct: totalCorners > 0 ? goals / totalCorners : 0,
  };
}

export async function computePlayerSeasonSummary(playerId: string) {
  const logs = await prisma.playerGameLog.findMany({
    where: { playerId },
    select: { goalsCount: true, assistsCount: true, totalTimeInGameMinutes: true, starter: true },
  });

  return {
    gamesPlayed: logs.length,
    gamesStarted: logs.filter((l) => l.starter).length,
    totalGoals: logs.reduce((sum, l) => sum + l.goalsCount, 0),
    totalAssists: logs.reduce((sum, l) => sum + l.assistsCount, 0),
    totalMinutes: logs.reduce((sum, l) => sum + (l.totalTimeInGameMinutes ?? 0), 0),
  };
}
