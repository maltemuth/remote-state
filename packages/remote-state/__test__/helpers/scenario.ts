/**
 * Generated scenarios of the model space for property tests: members join, connect
 * their sockets in either format, and act in turn. Playing one records everything
 * each member received, so properties can compare routes and look for leaks.
 */

import fc from 'fast-check';
import { type Socket } from 'socket.io-client';
import request from 'supertest';
import {
  type Format,
  type PatchesEvent,
  type RemoteStateServer,
  type RemoteStateServerOptions,
  type StateEvent,
} from '../../src/index.js';
import { openSocket, serverUrl, startServer } from './testServer.js';
import { waitUntil } from './waitUntil.js';
import { initialModelState, type ModelAction, modelRules, type ModelState } from './modelRules.js';

export type ModelServer = RemoteStateServer<ModelState>;

export const startModelServer = (options: RemoteStateServerOptions = {}) =>
  startServer(modelRules, options);

/** Scenarios per property; set PROPERTY_RUNS to search longer */
export const PROPERTY_RUNS = Number(process.env.PROPERTY_RUNS ?? 40);

/** Every member's notes start with their marker, so a leak can be spotted in any payload */
export const markerOf = (member: number) => `SECRET${member}-`;

/** Keys that need escaping in JSON Pointers, look like array indices, or are reserved (0047) */
const KEYS = [
  'a',
  'b',
  'a/b',
  'a~b',
  '~0',
  '~1',
  '-',
  '0',
  '10',
  '',
  ' ',
  'ü',
  '__proto__',
  'constructor',
  'prototype',
];

const actionArbitrary = (member: number): fc.Arbitrary<ModelAction> =>
  fc.oneof(
    {
      arbitrary: fc.record({
        type: fc.constant('insert' as const),
        index: fc.nat(10),
        value: fc.string({ maxLength: 3, unit: fc.constantFrom('x', 'y', '~', '/') }),
      }),
      weight: 4,
    },
    {
      arbitrary: fc.record({ type: fc.constant('remove' as const), index: fc.nat(10) }),
      weight: 2,
    },
    { arbitrary: fc.constant({ type: 'reverse' as const }), weight: 1 },
    {
      arbitrary: fc.record({
        type: fc.constant('set' as const),
        key: fc.constantFrom(...KEYS),
        value: fc.integer({ min: -5, max: 5 }),
      }),
      weight: 3,
    },
    {
      arbitrary: fc.record({ type: fc.constant('unset' as const), key: fc.constantFrom(...KEYS) }),
      weight: 2,
    },
    {
      arbitrary: fc.nat(99).map(n => ({ type: 'note' as const, text: `${markerOf(member)}${n}` })),
      weight: 3,
    },
    { arbitrary: fc.constant({ type: 'spectate' as const }), weight: 1 },
    { arbitrary: fc.constant({ type: 'sit' as const }), weight: 1 },
    { arbitrary: fc.constant({ type: 'invalid' as const }), weight: 1 }
  ) as fc.Arbitrary<ModelAction>;

export interface Step {
  member: number;
  action: ModelAction;
}

export interface Scenario {
  formats: Format[];
  steps: Step[];
}

export const scenarioArbitrary: fc.Arbitrary<Scenario> = fc
  .array(fc.constantFrom<Format>('state', 'immer'), { minLength: 1, maxLength: 3 })
  .chain(formats =>
    fc.record({
      formats: fc.constant(formats),
      steps: fc.array(
        fc
          .nat(formats.length - 1)
          .chain(member => actionArbitrary(member).map(action => ({ member, action }))),
        { maxLength: 25 }
      ),
    })
  );

export type Received =
  { event: 'state'; payload: StateEvent } | { event: 'patches'; payload: PatchesEvent };

export interface PlayedMember {
  memberId: string;
  token: string;
  format: Format;
  /** Socket events, in the order they arrived */
  events: Received[];
  /** Everything the member received, as JSON: socket events and HTTP response bodies */
  payloads: string[];
}

export interface Played {
  spaceId: string;
  /** The latest sequence */
  latest: number;
  members: PlayedMember[];
}

const lastSequence = (member: PlayedMember) => member.events.at(-1)?.payload.sequence ?? -1;

export const playScenario = async (server: ModelServer, scenario: Scenario): Promise<Played> => {
  // The listening server: supertest would start a server per request for the app
  const url = serverUrl(server);
  const spaceId = await server.createSpace(initialModelState());
  const sockets: Socket[] = [];
  try {
    const members: PlayedMember[] = [];
    for (const [index, format] of scenario.formats.entries()) {
      const code = await server.admit({ spaceId, identity: { id: `member-${index}` } });
      const { body, text } = await request(url).post('/api/tokens').send({ code });
      members.push({
        memberId: body.memberId,
        token: body.token,
        format,
        events: [],
        payloads: [text],
      });
    }

    for (const member of members) {
      const socket = openSocket(
        url,
        { spaceId, token: member.token },
        { query: { format: member.format } }
      );
      sockets.push(socket);
      const record = (event: 'state' | 'patches') => (payload: StateEvent & PatchesEvent) => {
        member.events.push({ event, payload } as Received);
        member.payloads.push(JSON.stringify(payload));
      };
      socket.on('state', record('state'));
      socket.on('patches', record('patches'));
      await waitUntil(() => member.events.length > 0, 'the view on connect');
    }

    let latest = Math.max(...members.map(lastSequence));
    for (const { member, action } of scenario.steps) {
      const response = await request(url)
        .post(`/api/spaces/${spaceId}/actions`)
        .set('Authorization', `Bearer ${members[member].token}`)
        .send({ action });
      members[member].payloads.push(response.text);
      if (response.status === 201) latest = response.body.sequence;
      else if (response.status !== 400) throw new Error(`Action failed: ${response.text}`);
    }

    await waitUntil(() => members.every(p => lastSequence(p) === latest), `sequence ${latest}`);
    return { spaceId, latest, members };
  } finally {
    sockets.forEach(socket => socket.disconnect());
  }
};
