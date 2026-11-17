import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicJson } from './reports';

function messagePath(root: string, messageId: string): string {
  return join(root, 'intake', `${createHash('sha256').update(messageId).digest('hex')}.json`);
}

/** Persist before debounce/dispatch. Unknown or interrupted records are never replayed automatically. */
export async function captureOrcaMessage<T extends { messageId: string }>(root: string, message: T): Promise<boolean> {
  const path = messagePath(root, message.messageId);
  await mkdir(join(root, 'intake'), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify({ status: 'queued', message }), { mode: 0o600, flag: 'wx' });
  try { await link(temp, path); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally { await unlink(temp).catch(() => {}); }
}

export async function recordOrcaMessageState(root: string, ids: readonly string[], state: Record<string, unknown>): Promise<void> {
  for (const id of ids) {
    const path = messagePath(root, id);
    const current = JSON.parse(await readFile(path, 'utf8'));
    await atomicJson(path, { ...current, ...state });
  }
}
