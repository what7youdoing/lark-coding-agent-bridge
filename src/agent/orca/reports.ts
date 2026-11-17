import { randomUUID } from 'node:crypto';
import { link, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type OrcaReportStatus = 'progress' | 'completed' | 'blocked' | 'failed';
export interface OrcaReport { status: OrcaReportStatus; text: string }

export async function atomicJson(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  try { await rename(temp, path); } finally { await unlink(temp).catch(() => {}); }
}

/** A report is evidence of supervisor output, never evidence of IM delivery. */
export async function writeOrcaReport(requestPath: string, status: OrcaReportStatus, text: string): Promise<void> {
  if (!['progress', 'completed', 'blocked', 'failed'].includes(status) || !text.trim() || Buffer.byteLength(text) > 1_000_000) {
    throw new Error('report requires a valid status and non-empty text up to 1 MB');
  }
  const request = JSON.parse(await readFile(requestPath, 'utf8'));
  if (request.protocol !== 'orca-report-v1' || typeof request.runId !== 'string') throw new Error('invalid report request');
  const dir = dirname(requestPath);
  if (status === 'progress') {
    await atomicJson(join(dir, 'progress.json'), { status, text });
    return;
  }
  // Publish a complete immutable final report. Concurrent/repeated finals cannot replace it.
  const temp = join(dir, `${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify({ status, text }), { mode: 0o600, flag: 'wx' });
  try {
    await link(temp, join(dir, 'final.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing = JSON.parse(await readFile(join(dir, 'final.json'), 'utf8'));
    if (existing.status !== status || existing.text !== text) throw new Error('a different final report already exists');
  } finally { await unlink(temp).catch(() => {}); }
}
