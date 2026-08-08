import { runPendingMigrations } from '../../lib/migrate';

/**
 * Not exposed via API Gateway — invoke manually once deployed:
 *   aws lambda invoke --function-name nextplay-api-dev-dbMigrate /dev/stdout
 * (or `npm run db:migrate:remote`). Runs inside the VPC, so it can reach the
 * RDS Proxy endpoint that a local machine outside the VPC cannot.
 */
export const handler = async () => {
  const result = await runPendingMigrations();
  // eslint-disable-next-line no-console
  console.log('Migration result', result);
  return result;
};
