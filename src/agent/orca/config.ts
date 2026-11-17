import { isAbsolute } from 'node:path';

export interface OrcaBinding {
  terminal: string;
  incarnationId: string;
  worktreeId: string;
  cwd: string;
}

export interface OrcaConfig {
  command: string;
  bindings: Record<string, OrcaBinding>;
}

/** Explicit opt-in, exact scope bindings; never launch or discover an agent. */
export function normalizeOrcaConfig(input: unknown): OrcaConfig {
  const raw = input as Partial<OrcaConfig> | undefined;
  if (!raw || typeof raw.command !== 'string' || !isAbsolute(raw.command) ||
      !raw.bindings || typeof raw.bindings !== 'object' || Array.isArray(raw.bindings)) {
    throw new Error('codex.orca requires an absolute command and explicit scope bindings');
  }
  const bindings: Record<string, OrcaBinding> = {};
  const terminals = new Set<string>();
  for (const [scope, b] of Object.entries(raw.bindings)) {
    if (!scope || !b || !['terminal', 'incarnationId', 'worktreeId', 'cwd'].every(k =>
      typeof b[k as keyof OrcaBinding] === 'string' && b[k as keyof OrcaBinding].length > 0) || !isAbsolute(b.cwd)) {
      throw new Error('invalid Orca scope binding');
    }
    if (terminals.has(b.terminal)) throw new Error('Orca scopes cannot share a supervisor conversation');
    terminals.add(b.terminal);
    bindings[scope] = { terminal: b.terminal, incarnationId: b.incarnationId, worktreeId: b.worktreeId, cwd: b.cwd };
  }
  if (!Object.keys(bindings).length) throw new Error('Orca requires at least one scope binding');
  return { command: raw.command, bindings };
}
