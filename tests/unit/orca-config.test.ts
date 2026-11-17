import { describe, expect, it } from 'vitest';
import { normalizeOrcaConfig } from '../../src/agent/orca/config';
import { orcaCommandRejection } from '../../src/agent/orca/commands';
import { createDefaultProfileConfig, normalizeProfileConfig } from '../../src/config/profile-schema';
import { createRuntimeAgent } from '../../src/runtime/agent-runtime';

const orca = { command: '/Applications/Orca.app/Contents/Resources/bin/orca', bindings: {
  chat: { terminal: 'term-1', incarnationId: 'inc-1', worktreeId: 'tree-1', cwd: '/workspace' },
} };
describe('Orca downstream integration', () => {
  it('preserves opt-in config across normalization and selects the Orca backend', () => {
    const profile = createDefaultProfileConfig({ agentKind: 'codex',
      accounts: { app: { id: 'app-test', secret: '${TEST_SECRET}', tenant: 'feishu' } },
      codex: { binaryPath: 'codex', orca } });
    expect(normalizeProfileConfig(profile).codex?.orca).toEqual(orca);
    expect(createRuntimeAgent(profile, { profileDir: '/tmp/profile' }).displayName).toBe('Orca Codex');
  });
  it('requires explicit bindings and absolute commands', () => {
    expect(() => normalizeOrcaConfig({ ...orca, command: 'orca' })).toThrow();
    expect(() => normalizeOrcaConfig({ ...orca, bindings: {} })).toThrow();
  });
  it('rejects misleading session/model controls for Orca, preserving other backends', () => {
    for (const command of ['new', 'reset', 'cd', 'ws', 'resume', 'config', 'stop']) {
      expect(orcaCommandRejection(command, true)).toBeTruthy();
      expect(orcaCommandRejection(command, false)).toBeUndefined();
    }
    expect(orcaCommandRejection('help', true)).toBeUndefined();
    expect(orcaCommandRejection('status', true)).toBeUndefined();
  });
});
