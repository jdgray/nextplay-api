import { createHash, randomUUID } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

/**
 * Applies pending migration.sql files under prisma/migrations/ directly via a
 * plain Postgres client, tracking state in Prisma's own `_prisma_migrations`
 * table format (same schema/columns `prisma migrate deploy` itself writes).
 *
 * Why this exists instead of shelling out to `prisma migrate deploy`: the
 * real Prisma CLI needs its schema-engine native binary for the Lambda's
 * platform (linux/rhel-openssl), which — unlike the query engine — isn't
 * reliably fetched cross-platform via `binaryTargets` when `prisma generate`
 * runs on a developer's Mac/Windows machine. Bundling/cross-compiling that
 * binary correctly is a well-known Prisma+Lambda pain point. Reading the SQL
 * directly avoids needing that binary at all.
 *
 * Because it writes the exact `_prisma_migrations` schema/checksums Prisma
 * itself uses, a later `prisma migrate deploy`/`status` run (e.g. from a
 * bastion once you have direct VPC access) will correctly recognize
 * migrations applied this way as already applied — this isn't a permanent
 * workaround, it stays compatible with normal Prisma tooling.
 */

const MIGRATIONS_DIR = join(__dirname, '../../prisma/migrations');

interface MigrationResult {
  applied: string[];
  skipped: string[];
}

function ensureMigrationsTableSql(): string {
  return `
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
    );
  `;
}

function listMigrationFolders(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
    .sort(); // timestamp-prefixed folder names (YYYYMMDDHHMMSS_name) sort chronologically
}

export async function runPendingMigrations(databaseUrl = process.env.DATABASE_URL): Promise<MigrationResult> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query(ensureMigrationsTableSql());

    for (const migrationName of listMigrationFolders()) {
      const sqlPath = join(MIGRATIONS_DIR, migrationName, 'migration.sql');
      const sql = readFileSync(sqlPath, 'utf-8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      const existing = await client.query(
        'SELECT "checksum", "finished_at" FROM "_prisma_migrations" WHERE "migration_name" = $1',
        [migrationName],
      );

      if (existing.rows.length > 0 && existing.rows[0].finished_at) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Checksum mismatch for already-applied migration "${migrationName}" — the migration.sql file ` +
              `changed after it was applied. Never edit a migration once it has run anywhere.`,
          );
        }
        skipped.push(migrationName);
        continue;
      }

      const id = randomUUID();
      const startedAt = new Date();
      await client.query(
        'INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "applied_steps_count") ' +
          'VALUES ($1, $2, $3, $4, 0)',
        [id, checksum, migrationName, startedAt],
      );

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }

      await client.query(
        'UPDATE "_prisma_migrations" SET "finished_at" = now(), "applied_steps_count" = 1 WHERE "id" = $1',
        [id],
      );

      applied.push(migrationName);
    }

    return { applied, skipped };
  } finally {
    await client.end();
  }
}
