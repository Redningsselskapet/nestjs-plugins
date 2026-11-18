# Update Without Breaking Changes

## Summary

A maintenance release of `@nestjs-plugins/nestjs-nats-jetstream-transport` that fixes known bugs, restores a working CI pipeline and adds automated tests, without changing the public API or default runtime behavior. It is for existing users of the library, who should be able to upgrade as a patch or minor version with no code changes.

## Problem

The library works for common setups but has several latent defects and no safety net:

- The pull request CI workflow cannot pass: it calls a Lerna command that was removed in the Lerna version the repo uses, and runs on Node 14, which is end-of-life.
- The supported Node versions are not declared anywhere, and the library already relies on features that do not exist in older Node versions. Nothing detects this, because the library's test script is a no-op.
- A malformed or empty payload sent to a request/reply handler causes an unhandled promise rejection, and the caller waits until it times out instead of getting an error.
- When an event handler fails, NestJS turns the error into a failed Observable, which the transport silently discards. The message is never settled by the transport: with manual acknowledgement it is redelivered after the acknowledgement timeout, and without it the client acknowledges it automatically and it is lost. Users cannot choose a different outcome.
- Stream setup reads only the first page of existing streams, so on servers with many streams it may try to create a stream that already exists and fail at startup.
- Closing a client that never connected throws.
- Only a payload that cannot be decoded is terminated by the transport. Handler failures are not, contrary to what the code appears to do, so users have no supported way to ask for immediate termination or a delayed redelivery on failure.
- Closing a server whose subscriptions are still finishing can throw, because a finished subscription checks a connection that has already been cleared.
- The library has no tests, so any change, including these fixes, is risky to release.

Fixing these now makes the library safe to change, and creates a base for a later major version that can make breaking changes (peer dependencies, newer NestJS, newer nats.js API).

## Goals

- Every existing user can upgrade without changing code or configuration, and sees the same behavior for valid inputs.
- Known crash and hang scenarios are fixed.
- CI runs and enforces lint, build and tests on every pull request.
- The library has automated unit and integration tests covering its core behavior.
- Users can opt into redelivery when an event handler fails.

## Non-goals

- Moving `@nestjs/*`, `rxjs` or `reflect-metadata` to peer dependencies.
- Supporting NestJS 10.4+/11 transport interface changes, if that requires breaking type changes.
- Migrating to the new nats.js consumer API or nats.js v3.
- Removing or renaming existing options. The client's `jetStreamOption` gets a new alias (see requirements) but keeps working.
- Changing how durable consumer names are derived.
- Changing how `listen()` behaves when the connection fails (it does not report the failure through its callback today, and consumers work around that).
- Changing how the client proxy creates and reuses its connection.
- Changing how stream setup merges config into existing streams, other than finding all existing streams.
- Redesigning the demo apps, beyond fixing incorrect examples and pointing them at the local library build.

## User stories

- As a library user, I want to upgrade to the new version without touching my code, so that I get fixes without migration work.
- As a library user, I want the supported Node versions to be stated clearly, so that I know whether I can upgrade or must stay on an older release.
- As a service owner, I want a failed event to be retried when I choose, so that a short outage does not lose events.
- As a caller of a request/reply endpoint, I want a prompt error when the server cannot decode my payload, so that I do not wait for a timeout.
- As an operator of a NATS server with many streams, I want my service to start reliably, so that stream setup does not fail because a stream was not found.
- As a maintainer, I want CI to run tests on every pull request, so that regressions are caught before release.

## Requirements

### Functional

- Durable consumer names must be produced identically to today for every subject.
- A request/reply handler that receives a payload that cannot be decoded must log the error and must not cause an unhandled promise rejection; the caller must get an error response or rejection rather than a timeout.
- Errors emitted by the Observable that an event handler returns (which includes every handler exception, as NestJS wraps them) must be caught, so that the new setting can act on them. With the setting unset, nothing extra must happen: the transport must not settle or additionally log the message, because NestJS already logs the error.
- Stream setup must consider all existing streams on the server, not just the first page, when deciding whether to create or update a stream.
- Calling `close()` on a client or server that never connected must complete without throwing.
- A new optional server setting must let users choose what happens when an event handler fails: terminate the message, or negatively acknowledge it so it is redelivered, optionally after a configurable delay.
- When the new setting is not provided, the error behavior must be identical to today: a handler failure leaves the message unsettled (redelivered after the acknowledgement timeout with manual acknowledgement, automatically acknowledged without it), and a payload that cannot be decoded is terminated.
- Closing a server must not throw, whether or not its subscriptions have finished.
- The new setting and any new exported types must be documented in the package README.
- The client options must accept `jetStreamOptions` as an alias for `jetStreamOption`, matching the server option name. The old name must keep working and be marked as deprecated in the type documentation. If both are given, `jetStreamOptions` takes precedence.
- The redelivery delay must accept zero, meaning immediate redelivery. A negative delay, or a delay combined with termination, must be rejected with a clear configuration error when the server is created.
- The `nats-listener` demo must use the correct context type for request/reply handlers.
- The `nats-publisher` demo must depend on the local library build, as `nats-listener` already does, so that both demos exercise local changes.

### Non-functional

- Compatibility: no exported symbol, option name, type or default may be removed or changed in a way that breaks existing TypeScript or JavaScript consumers. Only new optional options and new exports are allowed.
- Compatibility: the package's published contents (entry point, type declarations, file list) must stay the same.
- Runtime support: the library officially supports maintained Node LTS versions only, currently Node 22 and 24. The minimum supported version must be declared in the package metadata and stated in the README. Users on older Node versions stay on an earlier release of the package; keeping compatibility with end-of-life Node versions is not a goal, and declaring the minimum is not treated as a breaking change.
- CI: the pull request workflow must install dependencies, then lint, build and test all packages, on currently supported Node LTS versions, using maintained GitHub Actions versions.
- CI: the release and version-bump workflows must keep their current behavior (conventional-commit versioning, prerelease on merge, graduate on release), updated only as needed to run on supported Node and action versions.
- Testing: unit tests must cover the consumer options builder (including durable naming), the record builders, and the error-handling paths; integration tests must cover publish and consume, request/reply and stream setup against a real JetStream-enabled NATS server.
- Release: the change must be released as a minor version, because it adds an opt-in feature. Commit messages must drive that outcome under the existing conventional-commit setup: at least one `feat:` commit, and no commit marked as a breaking change.

## User experience

Users upgrade the package version and change nothing else. Their services start and behave as before. The only visible differences are:

- fewer crashes and hangs in the scenarios listed above
- a clear log entry and an error for the caller when a request/reply payload cannot be decoded.

Users who want redelivery on failure add the new optional setting to their server options, following a short README section that explains:

- the default behavior (unchanged from earlier versions), and the terminate and redeliver options
- how redelivery works together with the consumer's maximum delivery count
- the risk that a message which always fails is redelivered until that limit is reached.

## Edge cases

- Subjects containing `.`, `*` and `>` in any combination must map to the same durable name as today.
- An empty payload, a non-JSON payload and a valid JSON `null` sent to a request/reply handler must each have a defined, non-crashing outcome; valid `null` must keep today's behavior.
- An event handler that fails after the user has already acknowledged the message manually must not cause an additional error from double acknowledgement.
- Users who do not enable manual acknowledgement: the client acknowledges a message automatically once the handler returns. The new setting must take effect for errors raised before that point, and the README must state that errors raised later (by a long-running Observable) cannot change the outcome.
- A server with no existing streams, exactly one page of streams, and more than one page of streams must all be handled correctly by stream setup.
- Calling `close()` twice, or after a failed connection attempt, must not throw.
- A redelivery delay of zero means immediate redelivery; a negative delay stops the server from starting with a clear configuration error.
- A client configured with both `jetStreamOption` and `jetStreamOptions` uses `jetStreamOptions`.

## Acceptance criteria

- [ ] The pull request workflow runs on a test PR and passes lint, build and tests on Node 22 and 24.
- [ ] The library's test script runs real unit tests and they pass.
- [ ] Integration tests run against a JetStream-enabled NATS server in CI and pass.
- [ ] A server with a durable consumer starts successfully on every Node version in the CI matrix, and the durable names match the previous release for a fixed set of sample subjects.
- [ ] The package metadata and README state the minimum supported Node version.
- [ ] Sending a non-JSON payload to a request/reply handler produces an error for the caller before the request timeout, and no unhandled rejection is logged.
- [ ] An event handler returning an Observable that errors results in the configured failure behavior and a logged error.
- [ ] With the failure setting unset, a failing event handler leaves the message unsettled exactly as before (redelivered after the acknowledgement timeout with manual acknowledgement), and an undecodable event payload is still terminated.
- [ ] With the failure setting set to redeliver, a failing message is delivered again, and the configured delay is respected.
- [ ] Stream setup correctly updates an existing stream that is not on the first page of the stream listing.
- [ ] `close()` on a never-connected client and server completes without error.
- [ ] Both demo apps depend on and compile against the local library build, and their existing calls still work unchanged.
- [ ] A client configured with `jetStreamOptions` behaves the same as one configured with `jetStreamOption`, and existing configurations using `jetStreamOption` still work.
- [ ] A redelivery delay of zero redelivers immediately; a negative delay fails at startup with a clear error.
- [ ] The release produced by the conventional-commit tooling is a minor version bump.
- [ ] The README documents the new setting; no existing README instructions need to change.
- [ ] A diff of the published type declarations against the previous release shows only additions.
- [ ] aistracker's builds and test suites pass with the new version installed, and an event whose handler fails is still redelivered rather than terminated.

## Dependencies and assumptions

- A JetStream-enabled NATS server can be started in CI, for example as a container service.
- The current `nats` dependency range provides negative acknowledgement with a delay, and paging through the stream listing.
- Lerna remains the release tool; dropping it is out of scope.
- The `CI_REPOSITORY_ACCESS_TOKEN` and `NPM_TOKEN` secrets used by the existing workflows remain available.
- `rs-marine-services.aistracker` (`aistracker-api`, `aisdata-import`) depends on `^2.1.3` and runs Node 22, NestJS 8 and nats 2.19. Its NestJS 11 upgrade is deferred and waits on a later release of this library, so this release must keep NestJS 8 working. It relies on these behaviors, which this release must leave unchanged:
  - `listen()` does not settle when the connection fails; its startup retry loop and `unhandledRejection` filter depend on that.
  - Stream setup spreads the declared stream config over the live stream on every start; its stream-ownership rules depend on that.
  - Durable names are derived from the durable prefix and subject; its durables already exist in production.
  - With manual acknowledgement, a handler failure leaves the message unsettled so that `ackWait` and `maxDeliver` act as a backstop.
  - The client proxy reuses one connection, and `connect()` and `emit()` behave as today.
- Decisions made by the maintainer on 2026-11-18, reflected in the requirements above:
  - Supported Node versions: maintained LTS only (22 and 24); users on older Node pin an earlier release of the package.
  - Release type: minor.
  - Redelivery delay: zero means immediate; a negative value is rejected at startup.
  - Client option alias: add `jetStreamOptions`, and keep `jetStreamOption` working as deprecated.
  - `nats-publisher` demo: switch to the local library build.

## Open questions

- None at this time.
