# Orca execution backend

This fork retains the upstream bridge and adds an opt-in backend for an **existing local Orca Codex terminal**. It does not call a model API, create agents, change a model, toggle Fast, change permissions, or take over native chat.

## Configuration

Use an upstream schema-version-2 profile. Keep `agentKind: "codex"`; add `codex.orca`. `binaryPath` remains for compatibility with the upstream profile schema but is not executed by this backend.

```json
{
  "agentKind": "codex",
  "codex": {
    "binaryPath": "codex",
    "orca": {
      "command": "/Applications/Orca.app/Contents/Resources/bin/orca",
      "bindings": {
        "oc_EXAMPLE": {
          "terminal": "term_EXAMPLE",
          "incarnationId": "EXAMPLE",
          "worktreeId": "EXAMPLE",
          "cwd": "/absolute/workspace"
        }
      }
    }
  }
}
```

Use the normal upstream app credentials/secret-reference configuration, sender/chat allowlists, and mention requirement. No credentials belong in this file or the repository. For topic groups, the key is `chatId:threadId`; unbound topics are refused with an explanation. A terminal cannot be shared between scope bindings. Use one bridge profile per supervisor; do not configure the same terminal in another profile/process.

The runtime verifies terminal handle, incarnation, worktree, local host, Codex identity, and connection/writability immediately before submission. Its workspace must equal the profile's resolved workspace. The terminal's own policy remains authoritative: bridge permission preferences cannot sandbox an already-running supervisor. Keep its actual permissions consistent with the deployment policy.

## Reports and persistence

The backend stores private state beneath `<profileDir>/orca/`:

- `intake/`: immutable original message binding and current processing/delivery state, keyed by message-ID hash. Duplicate messages are suppressed across restart.
- `runs/<runId>/request.json`: prompt, source IDs, and frozen terminal binding.
- `runs/<runId>/state.json`: submission receipt, report status, and separate IM delivery status.
- `runs/<runId>/progress.json` and `final.json`: supervisor reports. Finals are immutable and identical repeated writes are idempotent.
- `leases/<terminalHash>/owner.json`: persistent exclusive ownership of the supervisor until a final report **and** final IM message receipt exist.

Each prompt includes the argv for `node dist/orca-report.js --request <request.json> --status completed|blocked|failed|progress --file <UTF-8-body-file>`. The supervisor must run it; terminal output alone does not finish a task. The adapter preserves Orca's `requestId` and stage list verbatim. `input_accepted`, `turn_started`, a supervisor report, and an IM delivery receipt remain separate facts. The adapter never infers a missing stage or invents usage/token events.

Submission timeout, interruption, process crash, and final-send failure retain the lease. No automatic replay, resend, or unlock occurs. Stop/shutdown detaches observation and does **not** kill or interrupt the persistent supervisor. `/stop`, `/new`, `/reset`, `/resume`, `/cd`, `/ws`, and `/config` are refused for this backend because upstream metadata changes would not change the actual Orca conversation. `/status` describes the bound terminal and makes no claim about its current model or sandbox.

For recovery, stop this profile, inspect the exact lease owner, run request/state, Orca terminal and durable submission receipt, and original Feishu message/replies. A late `final.json` is evidence to inspect, not permission to resend. Archive a resolved lease only after determining that no execution/delivery remains ambiguous. Queued messages survive as intake records, but the upstream debounce queue itself remains in memory; interrupted queued records require explicit reviewed recovery. Do not silently replay all `queued`/`unknown` records.

## Inherited capabilities and limits

Upstream quote/topic context fetching, attachment handling, batching, allowlists and reply rendering remain in the upstream path. The backend receives the resulting prompt and accepted local image paths. It reports progress/final text; native token streaming, tool/usage events, native Codex history/resume, automatic per-topic agent creation and live permission/model controls are not implemented for persistent Orca terminals. The normal Claude/Codex subprocess backends retain their upstream behavior.

## Verification

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

Unit tests cover binding validation, scope isolation, literal argv, acceptance versus completion, immutable reports, persistence and ambiguous outcomes. IM integration tests cover source-message IDs and delivery receipts/failures. Automated tests use fake Orca/Feishu surfaces; real terminal and Feishu verification must be recorded separately. No test creates an Agent or calls a model API.
