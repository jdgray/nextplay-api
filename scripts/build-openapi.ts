/**
 * Generates docs/openapi.yaml from the same zod schemas the handlers use for
 * request validation, so the spec can't drift from actual validation rules.
 */
import { writeFileSync } from 'fs';
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import YAML from 'yaml';

import { createOrganizationSchema, updateOrganizationSchema } from '../src/validation/organization';
import { createTeamSchema, updateTeamSchema } from '../src/validation/team';
import { updateUserSchema, assignRoleSchema } from '../src/validation/user';
import { createPlayerSchema, updatePlayerSchema } from '../src/validation/player';
import { createGameSchema, updateGameSchema } from '../src/validation/game';
import { bulkImportPlayerGameLogsSchema } from '../src/validation/player-game-log';
import { bulkImportDefensiveEventsSchema } from '../src/validation/defensive-event';
import { bulkImportCornerKickEventsSchema } from '../src/validation/corner-kick-event';
import { signupSchema, confirmSignupSchema, loginSchema, refreshSchema, logoutSchema } from '../src/validation/auth';

const registry = new OpenAPIRegistry();

registry.register('Signup', signupSchema);
registry.register('ConfirmSignup', confirmSignupSchema);
registry.register('Login', loginSchema);
registry.register('Refresh', refreshSchema);
registry.register('Logout', logoutSchema);
registry.register('CreateOrganization', createOrganizationSchema);
registry.register('UpdateOrganization', updateOrganizationSchema);
registry.register('CreateTeam', createTeamSchema);
registry.register('UpdateTeam', updateTeamSchema);
registry.register('UpdateUser', updateUserSchema);
registry.register('AssignRole', assignRoleSchema);
registry.register('CreatePlayer', createPlayerSchema);
registry.register('UpdatePlayer', updatePlayerSchema);
registry.register('CreateGame', createGameSchema);
registry.register('UpdateGame', updateGameSchema);
registry.register('BulkImportPlayerGameLogs', bulkImportPlayerGameLogsSchema);
registry.register('BulkImportDefensiveEvents', bulkImportDefensiveEventsSchema);
registry.register('BulkImportCornerKickEvents', bulkImportCornerKickEventsSchema);

const bearerAuth = registry.registerComponent('securitySchemes', 'cognitoJwt', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Access token issued by the Cognito user pool (see /auth/login)',
});

function path(
  method: 'get' | 'post' | 'patch' | 'delete',
  routePath: string,
  summary: string,
  opts: { body?: object; secure?: boolean } = {},
) {
  registry.registerPath({
    method,
    path: routePath,
    summary,
    security: opts.secure === false ? [] : [{ [bearerAuth.name]: [] }],
    request: opts.body ? { body: { content: { 'application/json': { schema: opts.body as never } } } } : undefined,
    responses: {
      200: { description: 'Success' },
      400: { description: 'Validation error' },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Not found' },
    },
  });
}

path('post', '/auth/signup', 'Create an account', { body: signupSchema, secure: false });
path('post', '/auth/confirm', 'Confirm a signup code', { body: confirmSignupSchema, secure: false });
path('post', '/auth/login', 'Log in', { body: loginSchema, secure: false });
path('post', '/auth/refresh', 'Refresh an access token', { body: refreshSchema, secure: false });
path('post', '/auth/logout', 'Log out (global sign-out)', { body: logoutSchema, secure: false });
path('get', '/auth/me', 'Get the current user and their roles');

path('post', '/organizations', 'Create an organization', { body: createOrganizationSchema });
path('get', '/organizations', 'List organizations the caller has a role in');
path('get', '/organizations/{id}', 'Get an organization');
path('patch', '/organizations/{id}', 'Update an organization', { body: updateOrganizationSchema });
path('delete', '/organizations/{id}', 'Delete an organization');

path('post', '/organizations/{orgId}/teams', 'Create a team', { body: createTeamSchema });
path('get', '/organizations/{orgId}/teams', 'List an organization’s teams');
path('get', '/teams/{id}', 'Get a team');
path('patch', '/teams/{id}', 'Update a team', { body: updateTeamSchema });
path('delete', '/teams/{id}', 'Delete a team');

path('get', '/users/{id}', 'Get a user');
path('patch', '/users/{id}', 'Update a user', { body: updateUserSchema });
path('get', '/users/{id}/roles', 'List a user’s roles');
path('post', '/users/{id}/roles', 'Assign a role to a user', { body: assignRoleSchema });
path('delete', '/roles/{roleId}', 'Remove a role');

path('post', '/teams/{teamId}/players', 'Add a player to a team', { body: createPlayerSchema });
path('get', '/teams/{teamId}/players', 'List a team’s players');
path('get', '/players/{id}', 'Get a player');
path('patch', '/players/{id}', 'Update a player', { body: updatePlayerSchema });
path('delete', '/players/{id}', 'Remove a player');

path('post', '/teams/{teamId}/games', 'Add a game to a team', { body: createGameSchema });
path('get', '/teams/{teamId}/games', 'List a team’s games');
path('get', '/games/{id}', 'Get a game');
path('patch', '/games/{id}', 'Update a game', { body: updateGameSchema });
path('delete', '/games/{id}', 'Remove a game');

path('get', '/games/{gameId}/player-game-logs', 'List player game logs for a game');
path('get', '/player-game-logs/{id}', 'Get a player game log');
path('post', '/player-game-logs/bulk-import', 'Bulk-import player game logs', {
  body: bulkImportPlayerGameLogsSchema,
});

path('get', '/games/{gameId}/defensive-events', 'List defensive events for a game');
path('get', '/defensive-events/{id}', 'Get a defensive event');
path('post', '/teams/{teamId}/defensive-events/bulk-import', 'Bulk-import defensive events', {
  body: bulkImportDefensiveEventsSchema,
});

path('get', '/games/{gameId}/corner-kick-events', 'List corner-kick events for a game');
path('get', '/corner-kick-events/{id}', 'Get a corner-kick event');
path('post', '/teams/{teamId}/corner-kick-events/bulk-import', 'Bulk-import corner-kick events', {
  body: bulkImportCornerKickEventsSchema,
});

path('get', '/teams/{teamId}/stats/defensive-metrics', 'Defensive metrics by attack source (mirrors the workbook’s side panel)');
path('get', '/teams/{teamId}/stats/corner-kick-metrics', 'Corner-kick conversion metrics (mirrors the workbook’s side panel)');
path('get', '/players/{id}/stats/season-summary', 'A player’s season totals (goals, assists, minutes)');

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'NextPlay API',
    version: '0.1.0',
    description: 'Serverless soccer team analytics API (organizations, teams, players, games, and per-game event data).',
  },
  servers: [{ url: '/' }],
});

writeFileSync('docs/openapi.yaml', YAML.stringify(document));
console.log('Wrote docs/openapi.yaml');
