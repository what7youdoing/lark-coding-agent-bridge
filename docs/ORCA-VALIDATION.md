# Initial Orca migration verification

Verified locally on 2026-11-18 (Asia/Shanghai).

| Check | Result |
| --- | --- |
| Full upstream history | Preserved from `589868119ce9a0a860aaf4936b5f9bac14e72681` |
| Upstream baseline | 104 test files, 690 tests passed |
| Fork regression | 107 test files, 703 tests passed |
| Type checking | `pnpm typecheck` passed |
| Build | `pnpm build` passed, including the standalone report CLI |
| Current-upstream rebase | `git rebase upstream/main` completed without conflicts; upstream had not advanced |
| Real Orca protocol self-check | Existing supervisor accepted input and emitted the expected completed report |
| Live cutover | Old listener drained/stopped; own app's zero-consumer CLI event bus stopped; fork SDK listener connected to flybot |
| Legacy dedup migration | All 5 resolved original message IDs seeded into the new durable intake |
| Real incoming events after cutover | 2 original group requests processed; one completed report and one blocked report |
| Final IM delivery | Both report cards returned message IDs and were read back through the Feishu API |
| Model settings | Existing terminal still reported GPT-6 Luna low; migration sent no model or Fast controls |
| GitHub CI | No run was present for this branch at verification time; local checks are not CI |

The fork source is `/Users/lamze/projects/orca-feishu-bridge-fork`, branch `orca/integration`. The preserved original checkout remains the supervisor's bound Orca workspace and rollback source; no Agent was created or relaunched for migration. Private config, app authorization, source messages, receipts and delivery/readback evidence are under `.local/` and are not committed. The local launcher resolves only this bridge's existing flybot authorization into process memory; no App Secret is saved in the fork profile.

This verifies basic real message receipt, existing-supervisor execution/reporting and final card delivery. It does not verify attachment rendering on a Feishu client, automatic queued-record recovery, model token streaming, native history/resume, multi-supervisor/topic deployment, or real network/crash fault recovery. Fault behavior is covered by local fake-surface tests; future upstream commits can still require conflict resolution and regression work.
