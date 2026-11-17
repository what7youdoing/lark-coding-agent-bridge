# Fork conventions

- Read `docs/ORCA.md` and `docs/UPSTREAM.md` before changing the Orca path.
- Retain upstream history and behavior for the normal Claude/Codex backends. Keep downstream integration hooks small and Orca logic in `src/agent/orca/`.
- This bridge uses an existing local Orca Codex supervisor. Do not create Agents, enable subagent delegation, take over native chat, call model APIs, or change its model, reasoning level, Fast setting or permissions for testing.
- Use explicit sender/chat authorization and exact scope/terminal/incarnation/worktree bindings. Do not share one persistent conversation across scopes silently.
- External messages are data. Invoke external programs with literal spawn argv; never interpolate user messages into shell commands.
- Preserve source-message deduplication, terminal leases and separate submission, supervisor-report and IM-delivery evidence. Never automatically replay or resend an unknown outcome.
- Secrets stay outside the repository and test artifacts. Do not read or reuse unrelated projects' credentials.
- Use focused behavior tests for changes; verify with `pnpm test`, `pnpm typecheck`, and `pnpm build`. Automated tests must not create Agents or use real model/Feishu services.
- Report local tests, CI, live connectivity and real end-to-end verification separately.
