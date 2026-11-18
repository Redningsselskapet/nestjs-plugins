# Update Without Breaking Changes

## Summary

A maintenance release of `@nestjs-plugins/nestjs-nats-jetstream-transport` that fixes known bugs, restores a working CI pipeline and adds automated tests, without changing the public API or default runtime behavior. It is for existing users of the library, who should be able to upgrade as a patch or minor version with no code changes.

## Problem

The library works for common setups but has several latent defects and no safety net:

- The pull request CI workflow cannot pass: it calls a Lerna command that was removed in the Lerna version the repo uses, and runs on Node 14, which is end-of-life.
- The supported Node versions are not declared anywhere, and the library already relies on features that do not exist in older Node versions. Nothing detects this, because the library's test script is a no-op.
- A malformed or empty payload sent to a request/reply handler causes an unhandled promise rejection, and the caller waits until it times out instead of getting an error.
- Errors raised by event handlers that return an Observable are not caught.
- Stream setup reads only the first page of existing streams, so on servers with many streams it may try to create a stream that already exists and fail at startup.
- Closing a client that never connected throws.
- A failing event handler always terminates the message, so a short outage in a downstream system (for example, the database) permanently loses the event. Users cannot choose to have the message redelivered instead.
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
- Errors emitted by an Observable returned from an event handler must be caught and handled the same way as errors thrown by the handler.
- Stream setup must consider all existing streams on the server, not just the first page, when deciding whether to create or update a stream.
- Calling `close()` on a client or server that never connected must complete without throwing.
- A new optional server setting must let users choose what happens when an event handler fails: terminate the message (the current behavior and the default), or negatively acknowledge it so it is redelivered, optionally after a configurable delay.
- When the new setting is not provided, the error behavior must be identical to today.
- The new setting and any new exported types must be documented in the package README.
- The client options must accept `jetStreamOptions` as an alias for `jetStreamOption`, matching the server option name. The old name must keep working and be marked as deprecated in the type documentation. If both are given, `jetStreamOptions` takes precedence.
- The redelivery delay must accept zero, meaning immediate redelivery. A negative delay must be rejected with a clear configuration error when the server starts.
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
- clearer log entries when a payload cannot be decoded or a handler's Observable errors.

Users who want redelivery on failure add the new optional setting to their server options, following a short README section that explains:

- the available behaviors, with terminate as the default
- how redelivery works together with the consumer's maximum delivery count
- the risk that a message which always fails is redelivered until that limit is reached.

## Edge cases

- Subjects containing `.`, `*` and `>` in any combination must map to the same durable name as today.
- An empty payload, a non-JSON payload and a valid JSON `null` sent to a request/reply handler must each have a defined, non-crashing outcome; valid `null` must keep today's behavior.
- An event handler that fails after the user has already acknowledged the message manually must not cause an additional error from double acknowledgement.
- Users who do not enable manual acknowledgement: the new failure setting must behave predictably (or be documented as having no effect) given the client's automatic acknowledgement.
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
- [ ] With the failure setting unset, a failing event handler terminates the message exactly as before.
- [ ] With the failure setting set to redeliver, a failing message is delivered again, and the configured delay is respected.
- [ ] Stream setup correctly updates an existing stream that is not on the first page of the stream listing.
- [ ] `close()` on a never-connected client and server completes without error.
- [ ] Both demo apps depend on and compile against the local library build, and their existing calls still work unchanged.
- [ ] A client configured with `jetStreamOptions` behaves the same as one configured with `jetStreamOption`, and existing configurations using `jetStreamOption` still work.
- [ ] A redelivery delay of zero redelivers immediately; a negative delay fails at startup with a clear error.
- [ ] The release produced by the conventional-commit tooling is a minor version bump.
- [ ] The README documents the new setting; no existing README instructions need to change.
- [ ] A diff of the published type declarations against the previous release shows only additions.

## Dependencies and assumptions

- A JetStream-enabled NATS server can be started in CI, for example as a container service.
- The current `nats` dependency range provides negative acknowledgement with a delay, and paging through the stream listing.
- Lerna remains the release tool; dropping it is out of scope.
- The `CI_REPOSITORY_ACCESS_TOKEN` and `NPM_TOKEN` secrets used by the existing workflows remain available.
- Decisions made by the maintainer on 2026-11-18, reflected in the requirements above:
  - Supported Node versions: maintained LTS only (22 and 24); users on older Node pin an earlier release of the package.
  - Release type: minor.
  - Redelivery delay: zero means immediate; a negative value is rejected at startup.
  - Client option alias: add `jetStreamOptions`, and keep `jetStreamOption` working as deprecated.
  - `nats-publisher` demo: switch to the local library build.

## Open questions

- None at this time.
