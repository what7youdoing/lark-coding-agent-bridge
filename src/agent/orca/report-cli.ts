import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { writeOrcaReport, type OrcaReportStatus } from './reports';

try {
  const { values } = parseArgs({ options: {
    request: { type: 'string' }, status: { type: 'string' }, file: { type: 'string' },
  } });
  if (!values.request || !values.status || !values.file) throw new Error('missing report arguments');
  const text = await readFile(values.file, 'utf8');
  await writeOrcaReport(values.request, values.status as OrcaReportStatus, text);
  process.stdout.write('Report recorded. IM delivery is handled separately by the bridge.\n');
} catch {
  process.stderr.write('Report was not recorded; check request, status and file.\n');
  process.exitCode = 1;
}
