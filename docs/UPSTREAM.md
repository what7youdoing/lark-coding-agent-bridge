# Maintaining the fork

- Upstream: https://github.com/zarazhangrui/lark-coding-agent-bridge
- Fork: https://github.com/what7youdoing/lark-coding-agent-bridge
- Baseline: `589868119ce9a0a860aaf4936b5f9bac14e72681` (upstream main, v0.7.1)
- Integration branch: `orca/integration`
- Orca-specific code: `src/agent/orca/`; [configuration and boundaries](ORCA.md).

Keep `main` as an upstream mirror and downstream commits on `orca/integration`. Do not squash the upstream history into an import commit. Group adapter, integration hooks, and documentation separately. Generic upstream fixes should be separate patches suitable for contribution.

```sh
git fetch upstream
git branch backup/orca-before-update orca/integration
git switch orca/integration
git rebase upstream/main
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

Review upstream changes before rebase, especially agent interfaces, profile normalization, command/card dispatch, intake, run lifecycle, and final-delivery handling. Resolve conflicts against current contracts; passing a no-op rebase cannot guarantee future updates are conflict-free. Record old/new upstream SHA and downstream release SHA. Do not force-push a shared branch without coordination; publish a new release branch if rewriting would affect others.

Validate in an isolated checkout with private runtime state. Keep the old deployment and backups until the new version has passed its tests and real verification. Drain pending work and final deliveries, stop only this bridge's listener, back up state consistently, then start one listener for the app. Do not delete the lark-cli event bus or other applications' consumers. Rollback means stop the new profile, reconcile any dispatched/unknown tasks first, and restart the preserved old listener; never run both for the same app during cutover.

The original `/Users/lamze/projects/orca-feishu-bridge` checkout is a separate, uncommitted MVP and rollback source. This fork was cloned into a sibling checkout with full upstream history; no rebase or destructive replacement was performed on that MVP directory.
