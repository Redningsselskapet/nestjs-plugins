# NestJS 11 Support

## Summary

A release of `@nestjs-plugins/nestjs-nats-jetstream-transport` that works with NestJS 11 (`@nestjs/microservices` 11), while keeping today's runtime behavior. It is for services built on this transport, first of all `rs-marine-services.aistracker`, whose NestJS 11 upgrade is blocked until this release exists.

## Problem

- The transport is built and tested against NestJS 8 only (`@nestjs/*` 8.4.7).
- NestJS 11 changed the contract that custom transports implement. Checked against `@nestjs/microservices` 11.2.11:
  - the server base class now requires an event-subscription method (`on`) and a method that returns the underlying client (`unwrap`)
  - the client base class now requires `unwrap`
  - both base classes now expose a connection `status` stream.

  The transport implements none of these, so it fails to compile against NestJS 11. How it behaves at runtime under NestJS 11 has never been tested.
- `rs-marine-services.aistracker` carries six accepted NestJS 8.4.7 vulnerability findings (2 HIGH, 4 MEDIUM per image) that are fixed only in NestJS 9–11. Its upgrade spec (`_specs/nestjs-11-upgrade.md` in that repo) lists a NestJS 11 compatible release of this transport as its first prerequisite.
- The transport declares no peer dependencies, so nothing tells a consumer which NestJS versions it supports.

## Goals

- Services on NestJS 11 can use the transport with no change to their transport configuration or handler code.
- Runtime behavior on NestJS 11 matches today's behavior on NestJS 8 for everything aistracker relies on.
- One release supports both NestJS 8 and NestJS 11, so a service can take the new transport while still on NestJS 8, and upgrade NestJS as a separate step. This matches aistracker's staged rollout (transport first, then NestJS).
- The supported NestJS versions are declared and tested in CI.

## Non-goals

- Migrating to the `@nats-io/*` nats.js v3 packages.
- Changing defaults or semantics that aistracker relies on, even where they are awkward:
  - durable naming
  - how stream config is merged into an existing stream on every start
  - `listen()` not settling when the connection fails
  - the default handling of failed event handlers
  - connection reuse in the client.

  Improvements to any of these belong in a later, separately specified release.
- Testing NestJS 9 and 10 in CI. They are declared as supported because they lie between the two tested versions, as is common for NestJS libraries, but only the lowest and highest supported versions (8 and 11) are tested.
- Moving `rxjs` and `reflect-metadata` from dependencies to peer dependencies. That is a separate packaging change.
- Changing `listen()` to report connection failures. Built-in NestJS transports do report them, but aistracker's startup retry loop is built around today's behavior, so this needs its own release, coordinated with a change in aistracker.
- Any changes in aistracker itself; its upgrade is specified in its own repo.
- New transport features beyond what NestJS 11 requires.

## User stories

- As the aistracker maintainer, I want a transport release that works on NestJS 11, so that I can upgrade the services and clear the six NestJS 8 findings.
- As the aistracker maintainer, I want to deploy the new transport while still on NestJS 8, so that the transport change and the framework change go out as separate, low-risk steps.
- As a service developer, I want my existing transport configuration and handlers to keep working unchanged on NestJS 11, so that the upgrade is a dependency change, not a rewrite.
- As a service developer, I want to be able to get the underlying NATS connection and connection status the NestJS 11 way, so that health checks and diagnostics can use the standard NestJS API.
- As a maintainer of this library, I want CI to run the full test suite on both NestJS 8 and NestJS 11, so that neither silently breaks.

## Requirements

### Functional

- The server and client must satisfy the NestJS 11 custom transport contract: the type definitions compile against `@nestjs/microservices` 11, and every member NestJS 11 calls exists and behaves sensibly.
- The server's and client's "unwrap" must return the underlying NATS connection once connected, and fail with a clear error before that.
- The server's event-subscription method must forward the NATS connection's events (at least disconnect, reconnect and error) to the registered callbacks, in the same way NestJS 11's built-in NATS transport does.
- The server and client must expose a connection status stream that reports at least connected, disconnected and reconnecting, using the same status names as NestJS 11's built-in NATS transport.
- The new event-subscription method, "unwrap" and status stream must also be available on NestJS 8, where they are additive and change nothing that existing code uses.
- On NestJS 11, with the same configuration as today, the following must behave exactly as on NestJS 8:
  - a JetStream publish resolves only once the server acknowledges it
  - durable consumers keep their names, along with `deliverGroup`, `deliverTo` and `manualAck`
  - handlers receive the message context, and `ack()`, `nak()` and `term()` reach the message
  - a handler failure leaves the message unsettled by default; `eventHandlerError` still applies when it is set
  - a payload that cannot be decoded is still terminated
  - request/reply works, including the immediate error reply for invalid JSON
  - stream setup writes only the fields a service declares, and finds streams on every page of the listing
  - connection options, including reconnect settings such as unlimited reconnect attempts, are passed through unchanged
  - closing is safe to call more than once, and when not connected.
- The same release must keep working on NestJS 8, with the same behavior as 2.3.x.
- The package must declare `@nestjs/common` and `@nestjs/microservices` as peer dependencies covering NestJS 8 through 11. Installation must succeed without errors for services on NestJS 8 and on NestJS 11. The NestJS packages stay as development dependencies for building and testing.
- The README must state the supported NestJS versions and describe how to get the underlying connection and status on NestJS 11.

### Non-functional

- Compatibility:
  - A service on NestJS 8 must be able to upgrade from 2.3.x with no code or configuration changes.
  - A service on NestJS 11 must be able to use the transport with the same configuration and handler code as on NestJS 8.
- Rollout safety: an instance on the previous transport version and one on the new version must be able to share the same stream and durable consumer during a rolling deploy. Neither may rewrite stream or consumer configuration in a way the other undoes, and messages must still be acknowledged exactly once.
- Testing:
  - CI runs the unit and integration suites against both NestJS 8 and NestJS 11, on Node 22 and 24.
  - Integration tests run against a real JetStream server, through a real NestJS microservice of each major version.
- Runtime support: Node 22 or later, unchanged from 2.3.x. NestJS 11 itself requires Node 20 or later.
- Release: a 2.x minor version supporting NestJS 8 through 11, following the existing conventional-commit flow (`feat:` commits, nothing marked as breaking). If a single version turns out to be impossible without breaking NestJS 8 users, the release must instead be 3.0.0, and the reason must be recorded.

## User experience

- **Service developers on NestJS 8:** upgrading to this release changes nothing visible.
- **Service developers on NestJS 11:** they install this release alongside NestJS 11 and their existing `NatsJetStreamServer` and `NatsJetStreamTransport` setup works as before.
- **What's new:** services can ask the server or client for the underlying NATS connection, subscribe to connection events and watch the connection status, the same way as with NestJS's built-in NATS transport. These work on NestJS 8 too.
- **Clearer installs:** installing alongside an unsupported NestJS version produces a clear peer dependency warning instead of failing at runtime.

## Edge cases

- A durable consumer already exists on the server, created by an older transport version, with options that differ from the new configuration. The new version must bind to it exactly as today: consumer options are not changed on an existing durable.
- Old and new transport versions run side by side on the same durable during a rollout.
- NATS is unavailable when the service starts. The behavior must be the same as today, so that the existing `unhandledRejection` filter and retry loop in aistracker keep working: `listen()` does not settle, and the rejection carries the NATS error code.
- NATS disconnects and reconnects while the service is running. Subscriptions resume as today, the status stream shows the transitions, and the registered event callbacks receive them.
- "Unwrap" is called before `listen()` or `connect()` has completed, or after `close()`.
- NestJS 11 calls `close()` during shutdown, possibly more than once.
- A handler is registered for the same event pattern more than once. Behavior must match today's.
- NestJS 11's exception handling for event handlers: today's default relies on NestJS turning handler exceptions into an Observable that errors. This was confirmed unchanged in `@nestjs/microservices` 11.2.11 and must stay covered by a test.

## Acceptance criteria

- [ ] The library builds and type-checks against `@nestjs/microservices` 11 and 8.
- [ ] CI runs unit and integration tests on NestJS 8 and NestJS 11, on Node 22 and 24, and all pass.
- [ ] Integration tests on NestJS 11 cover:
  - publish with acknowledgement
  - request/reply
  - an invalid request payload
  - redelivery of an unsettled failed message after the acknowledgement timeout
  - `nak` with a delay and `term`
  - stream setup beyond the first page
  - repeated close.
- [ ] A durable created by transport 2.3.1 is reused by the new release with the same name, and messages flow without redelivery storms or duplicate processing.
- [ ] The server's and client's "unwrap" return the NATS connection after connecting.
- [ ] Integration tests show the status stream and the server's event callbacks reporting a disconnect and reconnect when the NATS server is restarted.
- [ ] The package declares `@nestjs/common` and `@nestjs/microservices` peer dependencies covering NestJS 8–11; `npm install` succeeds without errors in a NestJS 8 project and in a NestJS 11 project.
- [ ] The release is a 2.x minor version, unless a recorded reason required 3.0.0.
- [ ] A diff of the published type declarations against 2.3.1 shows only additions, or, if the release is a major version, every removal or change is listed in the release notes.
- [ ] With the new release installed and still on NestJS 8, `rs-marine-services.aistracker` builds and passes all its test suites, and its consumer smoke test passes:
  - an event is stored and acked
  - an event is redelivered during a Mongo outage and stored after it
  - the existing durable is reused.
- [ ] A trial upgrade of aistracker to NestJS 11 compiles against the new release, and the same smoke test passes. This trial is done in a throwaway worktree and is not part of aistracker's own upgrade.
- [ ] The README lists the supported NestJS versions and documents "unwrap", the status stream and connection events.

## Dependencies and assumptions

- `@nestjs/microservices` 11 (checked: 11.2.11) is the target. NestJS 11 requires Node 20 or later and rxjs 7, both of which the transport already meets.
- The current nats.js v2 client (`nats` ^2.19) works with NestJS 11 and stays the transport's client.
- The test setup from 2.3.x (Jest unit tests, integration tests against a JetStream server in Docker, CI on Node 22 and 24) is extended, not replaced.
- Releases publish through the trusted-publishing workflow introduced in 2.3.1.
- aistracker's requirements on the transport are taken from its `_specs/nestjs-11-upgrade.md` (Functional requirements and the "Mixed versions during rollout" and "The durable already exists" edge cases).
- Assumed: supporting NestJS 8 and 11 from one version is feasible, because the NestJS 11 additions can be implemented without affecting NestJS 8. This must be confirmed early in implementation; if it fails, see the release requirement above.
- Decisions made on 2026-11-18, following common practice for NestJS libraries and NestJS's own transports:
  - One 2.x minor version supports NestJS 8 through 11. A 3.0.0 is used only if that proves impossible.
  - NestJS 8–11 are declared as supported; CI tests only the lowest and highest (8 and 11).
  - Supported versions are declared as peer dependencies on `@nestjs/common` and `@nestjs/microservices`.
  - The server's event-subscription method forwards NATS connection events, as NestJS 11's built-in NATS transport does.
  - A connection status stream (connected, disconnected, reconnecting) is in scope.
  - `listen()` keeps today's failure behavior in this release.

## Open questions

- None at this time.
