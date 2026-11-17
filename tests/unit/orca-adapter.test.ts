import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrcaAdapter } from '../../src/agent/orca/adapter';
import { writeOrcaReport } from '../../src/agent/orca/reports';
import type { AgentEvent } from '../../src/agent/types';

const binding = { terminal: 'term_test', incarnationId: 'inc-1', worktreeId: 'worktree-1', cwd: '/workspace' };
const roots: string[] = [];
async function fixture() {
  const stateDir = await mkdtemp(join(tmpdir(), 'orca-adapter-'));
  roots.push(stateDir);
  const runner = vi.fn(async (_command: string, args: string[]) => {
    if (args[1] === 'show') return { ok: true, result: { terminal: {
      handle: binding.terminal, incarnationId: binding.incarnationId, worktreeId: binding.worktreeId,
      executionHostId: 'local', agentIdentity: 'codex', connected: true, writable: true, orphaned: false,
    } } };
    return { ok: true, result: { send: { accepted: true, prompt: {
      provider: 'codex', requestId: 'request-1', stages: ['input_accepted'],
    } } } };
  });
  const adapter = new OrcaAdapter({ command: '/orca', bindings: { chat: binding }, stateDir,
    reportCommand: ['node', '/report.js'], pollMs: 5, runner });
  const opts = { runId: 'run-1', scopeId: 'chat', prompt: 'literal $(touch /bad) `echo bad`', cwd: '/workspace' };
  return { stateDir, runner, adapter, opts };
}
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });

describe('Orca persistent supervisor backend', () => {
  it('rejects unbound scopes, workspace changes and session switching without sending', async () => {
    const { adapter, opts, runner } = await fixture();
    await expect(adapter.prepareRun({ ...opts, scopeId: 'other-topic' })).rejects.toThrow(/binding/);
    await expect(adapter.prepareRun({ ...opts, cwd: '/other' })).rejects.toThrow(/workspace/);
    await expect(adapter.prepareRun({ ...opts, threadId: 'another-thread' })).rejects.toThrow(/session/);
    expect(runner).not.toHaveBeenCalled();
  });
  it('blocks stale incarnation before submission', async () => {
    const { adapter, opts, runner } = await fixture();
    runner.mockResolvedValue({ ok: true, result: { terminal: { incarnationId: 'replaced' } } } as never);
    await expect(adapter.prepareRun(opts)).rejects.toThrow(/binding/);
    expect(runner).toHaveBeenCalledTimes(1);
  });
  it('keeps acceptance separate from final report and sends literal argv once', async () => {
    const { adapter, opts, runner, stateDir } = await fixture();
    await adapter.prepareRun(opts);
    const run = adapter.run(opts);
    const seen: AgentEvent[] = [];
    const consume = (async () => { for await (const e of run.events) seen.push(e); })();
    await vi.waitFor(() => expect(runner.mock.calls.filter(c => c[1][1] === 'send')).toHaveLength(1));
    expect(seen.some(e => e.type === 'done')).toBe(false);
    expect(await run.waitForExit(1)).toBe(false);
    const argv = runner.mock.calls.find(c => c[1][1] === 'send')![1];
    expect(argv[argv.indexOf('--text') + 1]).toContain(opts.prompt);
    const request = join(stateDir, 'runs', opts.runId, 'request.json');
    await writeOrcaReport(request, 'completed', 'Verified final result');
    await writeOrcaReport(request, 'completed', 'Verified final result');
    await expect(writeOrcaReport(request, 'completed', 'changed final')).rejects.toThrow(/already exists/);
    await consume;
    expect(seen).toContainEqual({ type: 'final_text', content: 'Verified final result' });
    expect(seen.at(-1)).toMatchObject({ type: 'done', terminationReason: 'normal' });
    const record = JSON.parse(await readFile(join(stateDir, 'runs', opts.runId, 'state.json'), 'utf8'));
    expect(record.receipt.stages).toEqual(['input_accepted']);
    expect(record.status).toBe('reported');
    expect(await run.waitForExit(1)).toBe(true);
    await run.recordDelivery!({ unknown: true });
    await expect(adapter.prepareRun({ ...opts, runId: 'run-2' })).rejects.toThrow(/unresolved/);
    await run.recordDelivery!({ messageId: 'om_final' });
    await adapter.prepareRun({ ...opts, runId: 'run-2' });
  });
  it('retains a durable terminal lease after ambiguous submission, including restart', async () => {
    const { adapter, opts, runner, stateDir } = await fixture();
    await adapter.prepareRun(opts);
    const original = runner.getMockImplementation()!;
    runner.mockImplementation(async (command, args) => {
      if (args[1] === 'send') throw new Error('socket timeout with sensitive diagnostics');
      return original(command, args);
    });
    const run = adapter.run(opts);
    const seen: AgentEvent[] = [];
    for await (const event of run.events) seen.push(event);
    expect(seen.at(-1)).toMatchObject({ type: 'error' });
    expect(JSON.stringify(seen)).not.toContain('sensitive');
    const restarted = new OrcaAdapter({ command: '/orca', bindings: { chat: binding }, stateDir,
      reportCommand: ['node', '/report.js'], runner });
    await expect(restarted.prepareRun({ ...opts, runId: 'run-2' })).rejects.toThrow(/unresolved/);
    expect(runner.mock.calls.filter(c => c[1][1] === 'send')).toHaveLength(1);
  });
  it('stop detaches and blocks future work without killing the supervisor', async () => {
    const { adapter, opts, runner } = await fixture();
    await adapter.prepareRun(opts);
    const run = adapter.run(opts);
    const consume = (async () => { for await (const _ of run.events) { /* consume */ } })();
    await vi.waitFor(() => expect(runner.mock.calls.filter(c => c[1][1] === 'send')).toHaveLength(1));
    await run.stop();
    await consume;
    await expect(adapter.prepareRun({ ...opts, runId: 'run-2' })).rejects.toThrow(/unresolved/);
    expect(runner.mock.calls.every(c => ['show', 'send'].includes(c[1][1]!))).toBe(true);
  });
  it('never allows two scopes to silently share one persistent conversation', async () => {
    const { stateDir, runner } = await fixture();
    expect(() => new OrcaAdapter({ command: '/orca', bindings: { a: binding, b: binding }, stateDir,
      reportCommand: ['node', '/report.js'], runner })).toThrow(/share/);
  });
});
