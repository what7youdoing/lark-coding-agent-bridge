import { spawn } from 'node:child_process';

export type OrcaRunner = (command: string, args: string[]) => Promise<any>;

/** Arguments remain literal. Never persist CLI stderr (it can contain credentials). */
export const runOrcaJson: OrcaRunner = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let settled = false;
  const finish = (error?: Error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error) { reject(error); return; }
    try { resolve(JSON.parse(output)); } catch { reject(new Error('Orca returned invalid JSON')); }
  };
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    finish(new Error('Orca CLI timed out; submission may be unknown'));
  }, 25_000);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    output += chunk;
    if (Buffer.byteLength(output) > 2_000_000) {
      child.kill('SIGTERM');
      finish(new Error('Orca output exceeded limit'));
    }
  });
  child.stderr.resume();
  child.on('error', () => finish(new Error('Orca CLI could not start')));
  child.on('close', code => finish(code === 0 ? undefined : new Error('Orca CLI failed')));
});
