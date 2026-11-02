// Breaks the code on purpose (task 022 Validation step 4): applies replacements to files, runs commands, restores the
// files and checks that `git diff HEAD` and `git status --short` hash as before.
// Usage: node mutate.mjs <spec.json>   spec: { name, edits: [{ file, from, to }], commands: [string] }
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const root = 'D:/Projects/VegaAI/finebank-v1';
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sha = (text) => createHash('sha256').update(text).digest('hex');
const state = () => ({
  diff: sha(execSync('git diff HEAD', { cwd: root, maxBuffer: 1 << 28 }).toString()),
  status: sha(execSync('git status --short', { cwd: root }).toString()),
});

const before = state();
const files = [...new Set(spec.edits.map((edit) => edit.file))];
for (const file of files) copyFileSync(`${root}/${file}`, `${root}/${file}.mutation-backup`);
let failedRuns = 0;
try {
  for (const { file, from, to } of spec.edits) {
    const path = `${root}/${file}`;
    const text = readFileSync(path, 'utf8');
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${file}: ${count} matches for ${JSON.stringify(from.slice(0, 80))}`);
    writeFileSync(path, text.replace(from, to));
  }
  console.log(`=== ${spec.name}: mutated ${files.join(', ')}`);
  for (const command of spec.commands) {
    console.log(`--- ${command}`);
    try {
      const output = execSync(command, { cwd: root, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
      console.log(output.split('\n').filter((line) => /Tests |passed|failed|×/.test(line)).slice(-12).join('\n'));
      console.log('RESULT: PASSED (the mutation was NOT caught by this command)');
    } catch (error) {
      failedRuns += 1;
      const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
      const lines = output.split('\n').filter((line) => /×|✘|FAIL|AssertionError|Expected|Received|expected|Tests |failed|passed|Error:/.test(line));
      console.log(lines.slice(0, 40).join('\n'));
      console.log('RESULT: FAILED (the mutation was caught)');
    }
  }
} finally {
  for (const file of files) {
    copyFileSync(`${root}/${file}.mutation-backup`, `${root}/${file}`);
    execSync(`rm "${root}/${file}.mutation-backup"`);
  }
  const after = state();
  console.log(`restored: diff ${after.diff === before.diff ? 'same' : 'DIFFERENT'}, status ${after.status === before.status ? 'same' : 'DIFFERENT'}`);
  console.log(`hashes: ${before.diff.slice(0, 12)} / ${before.status.slice(0, 12)}`);
}
console.log(`commands caught it: ${failedRuns}/${spec.commands.length}`);
