import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { captureOrcaMessage, recordOrcaMessageState } from '../../src/agent/orca/ledger';

describe('Orca durable intake', () => {
  it('captures once across restart and retains original message binding while updating state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-ledger-'));
    try {
      const message = { messageId: 'om_test', chatId: 'oc_test', senderId: 'ou_test', content: 'hello' };
      expect(await captureOrcaMessage(root, message)).toBe(true);
      expect(await captureOrcaMessage(root, { ...message, content: 'duplicate' })).toBe(false);
      await recordOrcaMessageState(root, ['om_test'], { status: 'accepted', runId: 'run-1' });
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(join(root, 'intake'));
      const record = JSON.parse(await readFile(join(root, 'intake', files[0]!), 'utf8'));
      expect(record.message).toEqual(message);
      expect(record.status).toBe('accepted');
      expect(record.runId).toBe('run-1');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
