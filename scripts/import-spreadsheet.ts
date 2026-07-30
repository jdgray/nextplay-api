/**
 * One-off (rerunnable) loader that reads the team workbook's Roster,
 * Master (Overall), Defensive Events, and Corner-Kick Analysis tabs and
 * upserts them into Postgres via Prisma. Distinct from schema migrations —
 * run with `npm run import:spreadsheet -- --file <path> --organizationId <uuid> [--dry-run]`.
 *
 * Known limitation: DefensiveEvent/CornerKickEvent rows that fail to resolve
 * a gameId (needsReview=true) are deduped on rerun by (opponentNameRaw) within
 * this team only — safe under the "one team per workbook" assumption, but not
 * a true natural key. PlayerGameLog rows are fully idempotent (unique on
 * gameId+playerId).
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { PrismaClient, AttackSource, CornerSide, CornerType } from '@prisma/client';
import { normalizeExcelDuration } from './duration';

const prisma = new PrismaClient();

interface Args {
  file: string;
  organizationId: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const organizationId = get('--organizationId');
  if (!organizationId) {
    throw new Error('Missing required argument: --organizationId <uuid>');
  }
  return {
    file: get('--file') ?? 'data/Master_GraniteBay15G_United_2026_2027_.xlsx',
    organizationId,
    dryRun: args.includes('--dry-run'),
  };
}

// One buffered worksheet's rows, keyed by their real Excel row number (1-based).
// Populated once via readWantedSheets() using exceljs's streaming reader —
// see the comment there for why we don't use exceljs's random-access
// Workbook.xlsx.readFile()/getWorksheet() API.
type SheetRows = Map<number, ExcelJS.Row>;

function getRow(rows: SheetRows | undefined, rowNumber: number): ExcelJS.Row | undefined {
  return rows?.get(rowNumber);
}

function buildHeaderMap(headerRow: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellText(cell.value);
    if (text) map.set(text.trim(), colNumber);
  });
  return map;
}

function cellText(value: ExcelJS.CellValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return undefined;
  if (typeof value === 'object') {
    if ('result' in value && value.result !== undefined) return String(value.result);
    if ('richText' in value) return (value.richText as { text: string }[]).map((r) => r.text).join('');
    return undefined;
  }
  return String(value);
}

function cellRaw(row: ExcelJS.Row | undefined, headerMap: Map<string, number>, header: string): ExcelJS.CellValue {
  if (!row) return undefined;
  const col = headerMap.get(header);
  if (!col) return undefined;
  const value = row.getCell(col).value;
  if (value && typeof value === 'object' && !(value instanceof Date) && 'result' in value) {
    return (value as { result: ExcelJS.CellValue }).result;
  }
  return value;
}

function cellString(
  row: ExcelJS.Row | undefined,
  headerMap: Map<string, number>,
  header: string,
): string | undefined {
  const value = cellRaw(row, headerMap, header);
  const text = cellText(value);
  return text?.trim() || undefined;
}

function cellNumber(row: ExcelJS.Row | undefined, headerMap: Map<string, number>, header: string): number | undefined {
  const value = cellRaw(row, headerMap, header);
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function cellDate(row: ExcelJS.Row | undefined, headerMap: Map<string, number>, header: string): Date | undefined {
  const value = cellRaw(row, headerMap, header);
  return value instanceof Date ? value : undefined;
}

function cellMinute(row: ExcelJS.Row | undefined, headerMap: Map<string, number>, header: string): number | undefined {
  return normalizeExcelDuration(cellRaw(row, headerMap, header));
}

function cellYesNo(row: ExcelJS.Row | undefined, headerMap: Map<string, number>, header: string): boolean | undefined {
  const text = cellString(row, headerMap, header);
  if (!text) return undefined;
  const upper = text.trim().toUpperCase();
  if (upper === 'Y') return true;
  if (upper === 'N') return false;
  return undefined;
}

function parseRosterLabel(rosterLabel: string): { fullName: string; jerseyNumber?: number } {
  const match = rosterLabel.match(/^(.*)_(\d+)$/);
  if (!match) {
    console.warn(`  ! Could not parse jersey number from roster label "${rosterLabel}"`);
    return { fullName: rosterLabel };
  }
  return { fullName: match[1].trim(), jerseyNumber: Number(match[2]) };
}

function parseSeasonFromFilename(file: string): string | undefined {
  const match = file.match(/(\d{4})_(\d{4})/);
  return match ? `${match[1]}-${match[2]}` : undefined;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function parseAttackSource(text: string | undefined): AttackSource | undefined {
  if (!text) return undefined;
  const upper = text.trim().toUpperCase();
  if (upper === 'LEFT' || upper === 'L') return AttackSource.LEFT;
  if (upper === 'CENTER' || upper === 'CENTRE' || upper === 'C') return AttackSource.CENTER;
  if (upper === 'RIGHT' || upper === 'R') return AttackSource.RIGHT;
  return undefined;
}

function parseCornerSide(text: string | undefined): CornerSide | undefined {
  if (!text) return undefined;
  const upper = text.trim().toUpperCase();
  if (upper === 'LEFT' || upper === 'L') return CornerSide.LEFT;
  if (upper === 'RIGHT' || upper === 'R') return CornerSide.RIGHT;
  return undefined;
}

/**
 * The "Type" column header implies a closed In/Out/Short/Pass vocabulary, but
 * the real workbook contains free-form values ("Ground", "In-swing", ...).
 * Map what we can to the enum; anything else is preserved in `notes` instead
 * of silently dropped.
 */
function parseCornerType(text: string | undefined): CornerType | undefined {
  if (!text) return undefined;
  const upper = text.trim().toUpperCase();
  if (upper.includes('IN')) return CornerType.IN;
  if (upper.includes('OUT')) return CornerType.OUT;
  if (upper.includes('SHORT')) return CornerType.SHORT;
  if (upper.includes('PASS')) return CornerType.PASS;
  return undefined;
}

interface RosterEntry {
  rosterLabel: string;
  externalPlayerId: string;
  fullName: string;
  jerseyNumber?: number;
}

const WANTED_SHEETS = ['Roster', 'Master (Overall)', 'Defensive Events', 'Corner-Kick Analysis'] as const;

/**
 * Reads only the four sheets we need, keyed by name, each as a Map of row
 * number -> Row. Uses exceljs's *streaming* reader rather than
 * `Workbook.xlsx.readFile()` — this workbook's pivot tables/caches (which
 * duplicate a 31k-row "flat view" sheet) make the normal DOM reader take
 * 20-30+ minutes on a file the streaming reader parses in under a second,
 * since streaming never materializes charts/pivot caches/styles into memory.
 */
async function readWantedSheets(file: string): Promise<{ sheets: Map<string, SheetRows>; seenNames: Set<string> }> {
  const sheets = new Map<string, SheetRows>(WANTED_SHEETS.map((name) => [name, new Map()]));
  const seenNames = new Set<string>();

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
    worksheets: 'emit',
  });

  for await (const worksheetReader of reader) {
    const name = (worksheetReader as unknown as { name: string }).name;
    seenNames.add(name);
    const bucket = sheets.get(name);
    for await (const row of worksheetReader) {
      if (bucket) bucket.set(row.number, row);
    }
  }

  return { sheets, seenNames };
}

async function main() {
  const args = parseArgs();
  console.log(`Importing "${args.file}" ${args.dryRun ? '(dry run)' : ''}`.trim());

  let organization: { id: string } | null = null;
  if (!args.dryRun) {
    organization = await prisma.organization.findUnique({ where: { id: args.organizationId } });
    if (!organization) {
      throw new Error(`Organization ${args.organizationId} does not exist. Create it first.`);
    }
  }

  const { sheets, seenNames } = await readWantedSheets(args.file);

  const summary = {
    playersCreated: 0,
    playersUpdated: 0,
    gamesCreated: 0,
    playerGameLogsUpserted: 0,
    defensiveEventsCreated: 0,
    cornerKickEventsCreated: 0,
    unmatchedPlayerNames: new Set<string>(),
    ambiguousOrUnresolvedGames: new Set<string>(),
  };

  // ---------------------------------------------------------------- Roster
  const rosterRows = sheets.get('Roster');
  if (!seenNames.has('Roster') || !rosterRows) throw new Error('Roster sheet not found');

  const teamName = cellText(getRow(rosterRows, 1)?.getCell(2).value)?.trim();
  if (!teamName) throw new Error('Could not read team name from Roster!B1');
  const season = parseSeasonFromFilename(args.file);

  const rosterHeaderRow = getRow(rosterRows, 2);
  if (!rosterHeaderRow) throw new Error('Could not read Roster header row (row 2)');
  const rosterHeaderMap = buildHeaderMap(rosterHeaderRow);
  const rosterEntries: RosterEntry[] = [];
  const rosterMaxRow = Math.max(0, ...rosterRows.keys());
  for (let rowNumber = 3; rowNumber <= rosterMaxRow; rowNumber++) {
    const row = getRow(rosterRows, rowNumber);
    const rosterLabel = cellString(row, rosterHeaderMap, 'PLAYER');
    const externalPlayerId = cellString(row, rosterHeaderMap, 'PLAYER ID');
    if (!rosterLabel && !externalPlayerId) break;
    if (!rosterLabel || !externalPlayerId) continue;
    rosterEntries.push({ rosterLabel, externalPlayerId, ...parseRosterLabel(rosterLabel) });
  }
  console.log(`Roster: ${rosterEntries.length} players, team "${teamName}", season ${season ?? '(unknown)'}`);

  if (args.dryRun) {
    console.log('Dry run — skipping all database writes. Re-run without --dry-run to persist.');
    printSummary(summary);
    return;
  }

  const team = await findOrCreateTeam(organization!.id, teamName, season);

  const rosterLabelToPlayerId = new Map<string, string>();
  for (const entry of rosterEntries) {
    const player = await prisma.player.upsert({
      where: { teamId_externalPlayerId: { teamId: team.id, externalPlayerId: entry.externalPlayerId } },
      create: {
        teamId: team.id,
        externalPlayerId: entry.externalPlayerId,
        rosterLabel: entry.rosterLabel,
        fullName: entry.fullName,
        jerseyNumber: entry.jerseyNumber,
      },
      update: { rosterLabel: entry.rosterLabel, fullName: entry.fullName, jerseyNumber: entry.jerseyNumber },
    });
    rosterLabelToPlayerId.set(normalizeName(entry.rosterLabel), player.id);
  }

  function resolvePlayer(name: string | undefined): string | undefined {
    if (!name) return undefined;
    const id = rosterLabelToPlayerId.get(normalizeName(name));
    if (!id) summary.unmatchedPlayerNames.add(name);
    return id;
  }

  // ---------------------------------------------------------- Master (Overall)
  const masterRows = sheets.get('Master (Overall)');
  if (masterRows && masterRows.size > 0) {
    const masterHeaderRow = getRow(masterRows, 1);
    if (!masterHeaderRow) throw new Error('Could not read Master (Overall) header row (row 1)');
    const headerMap = buildHeaderMap(masterHeaderRow);
    const gameCache = new Map<string, string>(); // `${opponent}|${externalGameId ?? date}` -> gameId
    const distinctGameIds = new Set<string>();
    const masterMaxRow = Math.max(0, ...masterRows.keys());

    for (let rowNumber = 2; rowNumber <= masterMaxRow; rowNumber++) {
      const row = getRow(masterRows, rowNumber);
      const playerLabel = cellString(row, headerMap, 'Player');
      if (!playerLabel) break; // first fully blank row marks the end of real data

      const playerId = resolvePlayer(playerLabel);
      if (!playerId) continue;

      const opponentName = cellString(row, headerMap, 'Vs Team') ?? 'Unknown';
      const gameDate = cellDate(row, headerMap, 'Game date');
      const externalGameId = cellNumber(row, headerMap, 'Game ID');
      const leagueType = cellString(row, headerMap, 'League Type');

      const gameCacheKey = `${opponentName}|${externalGameId ?? gameDate?.toISOString() ?? rowNumber}`;
      let gameId = gameCache.get(gameCacheKey);
      if (!gameId) {
        const game =
          externalGameId !== undefined
            ? await prisma.game.upsert({
                where: { teamId_externalGameId: { teamId: team.id, externalGameId } },
                create: { teamId: team.id, opponentName, gameDate, leagueType, externalGameId },
                update: { opponentName, gameDate, leagueType },
              })
            : await findOrCreateGameByOpponentAndDate(team.id, opponentName, gameDate, leagueType);
        gameId = game.id;
        gameCache.set(gameCacheKey, gameId);
      }
      // Cache misses don't imply a new DB row — rows lacking both an
      // externalGameId and a date all fall back to the same cache-miss path
      // but correctly dedupe onto one game via findOrCreateGameByOpponentAndDate.
      // Count distinct resolved IDs instead of cache misses.
      distinctGameIds.add(gameId);

      const starter = cellYesNo(row, headerMap, 'Starter (Y/N)');
      const notes = cellString(row, headerMap, 'Notes');
      const totalTimeInGameMinutes = cellNumber(row, headerMap, 'Total Time in Game (min)');
      const onBenchMinutes = cellNumber(row, headerMap, 'On Bench (min)');
      const goalColumn = cellNumber(row, headerMap, 'Goal');
      const assistColumn = cellNumber(row, headerMap, 'Assist');

      const subIntervals = [] as { sequence: number; timeInMinute: number; timeOutMinute?: number }[];
      for (let i = 1; i <= 6; i++) {
        const timeInMinute = cellMinute(row, headerMap, `Time In ${i}`);
        if (timeInMinute === undefined) continue;
        const timeOutMinute = cellMinute(row, headerMap, `Time Out ${i}`);
        subIntervals.push({ sequence: i, timeInMinute, timeOutMinute });
      }

      const goalEvents = [] as { sequence: number; minute: number; position?: string }[];
      const assistEvents = [] as { sequence: number; minute: number; position?: string }[];
      for (let i = 1; i <= 3; i++) {
        const goalMinute = cellNumber(row, headerMap, `Goal Time (min)${i}`);
        if (goalMinute !== undefined) {
          goalEvents.push({ sequence: i, minute: Math.round(goalMinute), position: cellString(row, headerMap, `Position Goal${i}`) });
        }
        const assistMinute = cellNumber(row, headerMap, `Assist Time (min)${i}`);
        if (assistMinute !== undefined) {
          assistEvents.push({
            sequence: i,
            minute: Math.round(assistMinute),
            position: cellString(row, headerMap, `Position Assist${i}`),
          });
        }
      }

      const log = await prisma.playerGameLog.upsert({
        where: { gameId_playerId: { gameId, playerId } },
        create: {
          gameId,
          playerId,
          starter,
          notes,
          totalTimeInGameMinutes: totalTimeInGameMinutes !== undefined ? Math.round(totalTimeInGameMinutes) : undefined,
          onBenchMinutes: onBenchMinutes !== undefined ? Math.round(onBenchMinutes) : undefined,
          goalsCount: goalColumn ?? goalEvents.length,
          assistsCount: assistColumn ?? assistEvents.length,
        },
        update: {
          starter,
          notes,
          totalTimeInGameMinutes: totalTimeInGameMinutes !== undefined ? Math.round(totalTimeInGameMinutes) : undefined,
          onBenchMinutes: onBenchMinutes !== undefined ? Math.round(onBenchMinutes) : undefined,
          goalsCount: goalColumn ?? goalEvents.length,
          assistsCount: assistColumn ?? assistEvents.length,
        },
      });

      await prisma.subInterval.deleteMany({ where: { playerGameLogId: log.id } });
      await prisma.goalEvent.deleteMany({ where: { playerGameLogId: log.id } });
      await prisma.assistEvent.deleteMany({ where: { playerGameLogId: log.id } });
      if (subIntervals.length) {
        await prisma.subInterval.createMany({ data: subIntervals.map((s) => ({ ...s, playerGameLogId: log.id })) });
      }
      if (goalEvents.length) {
        await prisma.goalEvent.createMany({ data: goalEvents.map((g) => ({ ...g, playerGameLogId: log.id })) });
      }
      if (assistEvents.length) {
        await prisma.assistEvent.createMany({ data: assistEvents.map((a) => ({ ...a, playerGameLogId: log.id })) });
      }

      summary.playerGameLogsUpserted++;
    }
    summary.gamesCreated = distinctGameIds.size;
  } else {
    console.warn('Master (Overall) sheet not found — skipping');
  }

  // Games this team has on record, for opponent-name resolution below.
  const teamGames = await prisma.game.findMany({ where: { teamId: team.id } });

  async function resolveGameByOpponent(opponentNameRaw: string): Promise<{ gameId?: string; needsReview: boolean }> {
    const matches = teamGames.filter((g) => normalizeName(g.opponentName) === normalizeName(opponentNameRaw));
    if (matches.length === 1) return { gameId: matches[0].id, needsReview: false };
    summary.ambiguousOrUnresolvedGames.add(opponentNameRaw);
    return { needsReview: true };
  }

  const teamGameIds = teamGames.map((g) => g.id);

  // ------------------------------------------------------------ Defensive Events
  const defenseRows = sheets.get('Defensive Events');
  if (defenseRows && defenseRows.size > 0) {
    const headerRowNumber = findHeaderRow(defenseRows, 'Game');
    if (headerRowNumber) {
      const defenseHeaderRow = getRow(defenseRows, headerRowNumber)!;
      const headerMap = buildHeaderMap(defenseHeaderRow);
      const rows: Parameters<typeof prisma.defensiveEvent.create>[0]['data'][] = [];
      const opponentNamesInBatch = new Set<string>();
      const defenseMaxRow = Math.max(0, ...defenseRows.keys());

      for (let rowNumber = headerRowNumber + 1; rowNumber <= defenseMaxRow; rowNumber++) {
        const row = getRow(defenseRows, rowNumber);
        const opponentNameRaw = cellString(row, headerMap, 'Game');
        if (!opponentNameRaw) break;
        opponentNamesInBatch.add(opponentNameRaw);

        const { gameId, needsReview } = await resolveGameByOpponent(opponentNameRaw);
        const minute = cellMinute(row, headerMap, 'Minute') ?? 0;

        rows.push({
          gameId,
          opponentNameRaw,
          needsReview,
          minute,
          goalAgainst: cellYesNo(row, headerMap, 'Goal Against (Y/N)') ?? false,
          goalScorerOpponent: cellString(row, headerMap, 'Goal Scorer (Opponent)'),
          goalkeeperId: resolvePlayer(cellString(row, headerMap, 'Goalkeeper')),
          leftBackId: resolvePlayer(cellString(row, headerMap, 'LB (from Roster)')),
          cdmId: resolvePlayer(cellString(row, headerMap, 'CDM (from Roster)')),
          rightBackId: resolvePlayer(cellString(row, headerMap, 'RB (from Roster)')),
          defensiveErrorPlayerId: resolvePlayer(cellString(row, headerMap, 'Defensive Error Player')),
          missedHelpPlayerId: resolvePlayer(cellString(row, headerMap, 'Missed Help Player')),
          defensiveShape: cellString(row, headerMap, 'Defensive Shape'),
          attackSource: parseAttackSource(cellString(row, headerMap, 'Attack Source (L/C/R)')),
          goalTypeNotes: cellString(row, headerMap, 'Goal Type Notes'),
          minutesInPositionBeforeGoal: cellNumber(row, headerMap, 'Minutes in Position Before Goal'),
        });
      }

      await prisma.defensiveEvent.deleteMany({
        where: {
          OR: [
            { gameId: { in: teamGameIds } },
            { gameId: null, opponentNameRaw: { in: [...opponentNamesInBatch] } },
          ],
        },
      });
      if (rows.length) {
        await prisma.defensiveEvent.createMany({ data: rows });
        summary.defensiveEventsCreated = rows.length;
      }
    } else {
      console.warn('Could not find Defensive Events header row — skipping');
    }
  } else {
    console.warn('Defensive Events sheet not found — skipping');
  }

  // ------------------------------------------------------------ Corner-Kick Analysis
  const cornerRows = sheets.get('Corner-Kick Analysis');
  if (cornerRows && cornerRows.size > 0) {
    const headerRowNumber = findHeaderRow(cornerRows, 'Game');
    if (headerRowNumber) {
      const cornerHeaderRow = getRow(cornerRows, headerRowNumber)!;
      const headerMap = buildHeaderMap(cornerHeaderRow);
      const rows: Parameters<typeof prisma.cornerKickEvent.create>[0]['data'][] = [];
      const opponentNamesInBatch = new Set<string>();
      const cornerMaxRow = Math.max(0, ...cornerRows.keys());

      for (let rowNumber = headerRowNumber + 1; rowNumber <= cornerMaxRow; rowNumber++) {
        const row = getRow(cornerRows, rowNumber);
        const opponentNameRaw = cellString(row, headerMap, 'Game');
        if (!opponentNameRaw) break;
        opponentNamesInBatch.add(opponentNameRaw);

        const { gameId, needsReview } = await resolveGameByOpponent(opponentNameRaw);
        const minute = cellMinute(row, headerMap, 'Minute') ?? 0;
        const rawType = cellString(row, headerMap, 'Type (In/Out/Short/Pass)');
        const parsedType = parseCornerType(rawType);
        const outcome = cellString(row, headerMap, 'Outcome');
        const sourceNotes = cellString(row, headerMap, 'Notes');
        const notes = [sourceNotes, !parsedType && rawType ? `Type: ${rawType}` : undefined]
          .filter(Boolean)
          .join(' | ') || undefined;

        rows.push({
          gameId,
          opponentNameRaw,
          needsReview,
          minute,
          side: parseCornerSide(cellString(row, headerMap, 'Side (L/R)')),
          takerId: resolvePlayer(cellString(row, headerMap, 'Taker')),
          type: parsedType,
          targetZone: cellString(row, headerMap, 'Target Zone'),
          outcome,
          shot: cellYesNo(row, headerMap, 'Shot (Y/N)') ?? false,
          goal: cellYesNo(row, headerMap, 'Goal (Y/N)') ?? false,
          receiverId: resolvePlayer(cellString(row, headerMap, 'Receiver')),
          notes,
        });
      }

      await prisma.cornerKickEvent.deleteMany({
        where: {
          OR: [
            { gameId: { in: teamGameIds } },
            { gameId: null, opponentNameRaw: { in: [...opponentNamesInBatch] } },
          ],
        },
      });
      if (rows.length) {
        await prisma.cornerKickEvent.createMany({ data: rows });
        summary.cornerKickEventsCreated = rows.length;
      }
    } else {
      console.warn('Could not find Corner-Kick Analysis header row — skipping');
    }
  } else {
    console.warn('Corner-Kick Analysis sheet not found — skipping');
  }

  printSummary(summary);
}

function findHeaderRow(rows: SheetRows, expectedFirstHeader: string, scanRows = 10): number | undefined {
  const maxRow = Math.min(scanRows, Math.max(0, ...rows.keys()));
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber++) {
    const value = cellText(getRow(rows, rowNumber)?.getCell(1).value);
    if (value?.trim() === expectedFirstHeader) return rowNumber;
  }
  return undefined;
}

async function findOrCreateTeam(organizationId: string, name: string, season: string | undefined) {
  // Prisma's compound-unique lookup requires a non-null value for every key
  // field (Postgres treats NULLs as distinct, so it can't be used for a
  // reliable upsert `where`) — fall back to findFirst/create when season is
  // unknown.
  const existing = await prisma.team.findFirst({ where: { organizationId, name, season: season ?? null } });
  if (existing) return existing;
  return prisma.team.create({ data: { organizationId, name, season } });
}

async function findOrCreateGameByOpponentAndDate(
  teamId: string,
  opponentName: string,
  gameDate: Date | undefined,
  leagueType: string | undefined,
) {
  const existing = await prisma.game.findFirst({
    where: { teamId, opponentName, gameDate: gameDate ?? null, externalGameId: null },
  });
  if (existing) return existing;
  return prisma.game.create({ data: { teamId, opponentName, gameDate, leagueType } });
}

function printSummary(summary: {
  playersCreated: number;
  playersUpdated: number;
  gamesCreated: number;
  playerGameLogsUpserted: number;
  defensiveEventsCreated: number;
  cornerKickEventsCreated: number;
  unmatchedPlayerNames: Set<string>;
  ambiguousOrUnresolvedGames: Set<string>;
}) {
  console.log('\n--- Import summary ---');
  console.log(`Games upserted:            ${summary.gamesCreated}`);
  console.log(`Player game logs upserted: ${summary.playerGameLogsUpserted}`);
  console.log(`Defensive events written:  ${summary.defensiveEventsCreated}`);
  console.log(`Corner-kick events written: ${summary.cornerKickEventsCreated}`);
  if (summary.unmatchedPlayerNames.size) {
    console.log(`\nUnmatched player names (${summary.unmatchedPlayerNames.size}) — review manually:`);
    for (const name of summary.unmatchedPlayerNames) console.log(`  - ${name}`);
  }
  if (summary.ambiguousOrUnresolvedGames.size) {
    console.log(`\nEvents flagged needsReview — opponent name did not resolve to exactly one game (${summary.ambiguousOrUnresolvedGames.size}):`);
    for (const name of summary.ambiguousOrUnresolvedGames) console.log(`  - ${name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
