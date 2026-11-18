# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Lerna monorepo (npm workspaces, `version: independent`) under `packages/`:

- `nestjs-nats-jetstream-transport` — the only published package (`@nestjs-plugins/nestjs-nats-jetstream-transport`). A NestJS custom transport for NATS JetStream. Its README is the user-facing documentation for all options.
- `nats-listener`, `nats-publisher` — private NestJS demo apps that consume/produce through the transport. `nats-listener` depends on the library via `file:../nestjs-nats-jetstream-transport` (uses local source); `nats-publisher` uses the published npm version (`^2.0.0`), so local library changes are not picked up there unless the dependency is changed.

Install from the root with `npm ci` (npm workspaces). Everything is developed against NestJS 11 (the library's dev dependencies and both demos); NestJS 8 compatibility is checked by the CI job that installs `@nestjs/*@^8` into the library with `npm install --no-save -w @nestjs-plugins/nestjs-nats-jetstream-transport ...`. Run the same command locally to test on NestJS 8, and `npm ci` to go back. The root `package.json` also lists a `nohoist` entry, but that is a Yarn feature; npm ignores it and hoists everything to the root `node_modules`.

## Commands

Run inside the relevant package directory:

```bash
# transport library
npm run build             # rimraf dist && tsc -p tsconfig.build.json (dist/ is the only published output)
npm run watch
npm run lint              # eslint --fix;  npm run lint:check for CI (no fix)
npm run format            # prettier
npm test                  # jest unit tests, src/**/*.spec.ts (nats connect is mocked)
npx jest src/server.spec.ts -t "nak"      # single file / single test
npm run test:integration  # test/*.int-spec.ts against a real server at $NATS_URL (default nats://localhost:4222); set NATS_CONTAINER=<docker container> to include the NATS restart test

# demo apps (nats-listener / nats-publisher)
npm run start:dev
npm test                          # jest
npx jest src/app.controller.spec.ts   # single test file
npm run test:e2e
```

From the root: `npx lerna run build`, `npx lerna run test`. The demos import the library's `dist/`, so build the library first. Node 22 or later is required (`engines`).

A local JetStream-enabled NATS server is needed for the integration tests and the demos:

```bash
docker run -d --name nats-main -p 4222:4222 -p 6222:6222 -p 8222:8222 nats -js -m 8222
```

## Transport architecture (`packages/nestjs-nats-jetstream-transport/src`)

- **`server.ts` — `NatsJetStreamServer`** (a `CustomTransportStrategy`). On `listen()` it connects, optionally creates/updates streams from `streamConfig` (existing streams are *updated* by merging config and unioning subjects), then splits Nest handlers in two:
  - `@EventPattern` handlers → JetStream push subscriptions via `js.subscribe`, one consumer per subject. Consumer options come from `utils/server-consumer-options-builder.ts`. Handlers receive a `NatsJetStreamContext` (wraps `JsMsg`); with `manualAck: true` the handler must ack via `context.message.ack()`.
  - `@MessagePattern` handlers → plain core-NATS subscriptions (request/reply, not JetStream), queue group = `consumerOptions.deliverTo`, context is `NatsContext` (wraps `Msg`).
- **`client.ts` — `NatsJetStreamClientProxy`**: `emit()` → `dispatchEvent` → `js.publish` (JetStream); `send()` → `publish` → `nc.request` (core NATS request/reply). Wrap payloads in `NatsJetStreamRecordBuilder` / `NatsRequestRecordBuilder` (in `utils/`) to pass publish/request options — the proxy checks `instanceof` the record classes.
- **`nats-jetstream-transport.module.ts` — `NatsJetStreamTransport.register()/registerAsync()`** provides the client proxy with options under the `NATS_JETSTREAM_OPTIONS` token.
- All payloads are JSON-encoded with `JSONCodec`.
- **Handler errors never reach the server's `catch`.** NestJS's `RpcProxy` turns every handler (and pipe/guard) exception into an Observable that errors and logs it. The server subscribes to that Observable and applies the opt-in `eventHandlerError` option (`term` or `nak` with delay). When the option is unset it does nothing, so with `manualAck` the message is redelivered after `ackWait`. Consumers such as rs-marine-services.aistracker depend on that default. Only an undecodable payload is `term()`ed by the transport itself.
- `listen()` does not call its callback or reject when the connection or stream setup fails; downstream services work around this with retry loops, so don't change it in a minor release.
- NestJS 8 calls the strategy's `close()` twice when an app shuts down; `close()` must stay idempotent.
- **Durable naming:** when `durable` is set, the actual consumer name is `${durable}-${subject}` with `.` → `_` and `*`/`>` → `_ALL` (one durable per subject). Changing this breaks existing consumers on deployed servers.
- **One build for NestJS 8–11.** `@nestjs/common` and `@nestjs/microservices` are peer dependencies (`^8 || ^9 || ^10 || ^11`). The NestJS 11 contract members (`status`, `on()`, `unwrap()`) are implemented in `utils/connection-status.ts` and copy NestJS's own NATS transport. New code must not rely at runtime on base-class members that only exist in NestJS 11 (such as `_status$`), because on NestJS 8 they are missing.
- Everything public must be re-exported from `src/index.ts`.

## Release process (GitHub Actions)

Versioning is driven by **conventional commits** (`lerna version --conventional-commits`), so use conventional commit messages (`feat:`, `fix:`, `docs:` …).

- PR to `master` → on Node 22 and 24: `npm ci`, NATS JetStream in Docker, build (library first), `lerna run lint:check`, `lerna run test`, `lerna run test:integration`.
- PR merged → CI bumps changed packages to a prerelease (`--preid pre`) and pushes.
- GitHub release created → `release.yaml` graduates prereleases with `lerna version` (local commit and tags), builds, publishes every public package version not yet on npm with `npm publish --provenance`, and only then pushes. Publishing uses npm trusted publishing (OIDC, no token), which must be enabled for each package on npmjs.com with `release.yaml` as the workflow. Lerna's own `publish` is not used because it cannot do trusted publishing.

Don't bump versions or edit CHANGELOGs by hand; CI does it.
