# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Lerna monorepo (npm workspaces, `version: independent`) under `packages/`:

- `nestjs-nats-jetstream-transport` — the only published package (`@nestjs-plugins/nestjs-nats-jetstream-transport`). A NestJS custom transport for NATS JetStream. Its README is the user-facing documentation for all options.
- `nats-listener`, `nats-publisher` — private NestJS demo apps that consume/produce through the transport. `nats-listener` depends on the library via `file:../nestjs-nats-jetstream-transport` (uses local source); `nats-publisher` uses the published npm version (`^2.0.0`), so local library changes are not picked up there unless the dependency is changed.

The root `package.json` sets `nohoist` for the transport package, so it keeps its own `node_modules`.

## Commands

Run inside the relevant package directory:

```bash
# transport library
npm run build     # rimraf dist && tsc (output in dist/, the only published files)
npm run watch     # tsc -w
npm run lint      # eslint --fix
npm run format    # prettier
npm test          # no-op ("exit 0") — the library has no tests

# demo apps (nats-listener / nats-publisher)
npm run start:dev
npm test                          # jest
npx jest src/app.controller.spec.ts   # single test file
npm run test:e2e
```

From the root: `npx lerna run build`, `npx lerna run test`.

A local JetStream-enabled NATS server is needed to run the demos:

```bash
docker run -d --name nats-main -p 4222:4222 -p 6222:6222 -p 8222:8222 nats -js -m 8222
```

## Transport architecture (`packages/nestjs-nats-jetstream-transport/src`)

- **`server.ts` — `NatsJetStreamServer`** (a `CustomTransportStrategy`). On `listen()` it connects, optionally creates/updates streams from `streamConfig` (existing streams are *updated* by merging config and unioning subjects), then splits Nest handlers in two:
  - `@EventPattern` handlers → JetStream push subscriptions via `js.subscribe`, one consumer per subject. Consumer options come from `utils/server-consumer-options-builder.ts`. Handler exceptions cause `msg.term()` (no redelivery). Handlers receive a `NatsJetStreamContext` (wraps `JsMsg`); with `manualAck: true` the handler must ack via `context.message.ack()`.
  - `@MessagePattern` handlers → plain core-NATS subscriptions (request/reply, not JetStream), queue group = `consumerOptions.deliverTo`, context is `NatsContext` (wraps `Msg`).
- **`client.ts` — `NatsJetStreamClientProxy`**: `emit()` → `dispatchEvent` → `js.publish` (JetStream); `send()` → `publish` → `nc.request` (core NATS request/reply). Wrap payloads in `NatsJetStreamRecordBuilder` / `NatsRequestRecordBuilder` (in `utils/`) to pass publish/request options — the proxy checks `instanceof` the record classes.
- **`nats-jetstream-transport.module.ts` — `NatsJetStreamTransport.register()/registerAsync()`** provides the client proxy with options under the `NATS_JETSTREAM_OPTIONS` token.
- All payloads are JSON-encoded with `JSONCodec`.
- **Durable naming:** when `durable` is set, the actual consumer name is `${durable}-${subject}` with `.` → `_` and `*`/`>` → `_ALL` (one durable per subject). Changing this breaks existing consumers on deployed servers.
- Everything public must be re-exported from `src/index.ts`.

## Release process (GitHub Actions)

Versioning is driven by **conventional commits** (`lerna version --conventional-commits`), so use conventional commit messages (`feat:`, `fix:`, `docs:` …).

- PR to `master` → `lerna bootstrap --ci` + `lerna run test --since HEAD~1`.
- PR merged → CI bumps changed packages to a prerelease (`--preid pre`) and pushes.
- GitHub release created → `lerna publish --conventional-graduate` promotes prereleases and publishes to npm.

Don't bump versions or edit CHANGELOGs by hand; CI does it.
