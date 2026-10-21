#!/usr/bin/env node
/** prompt.md §14: pre-commit rejects .env, *.pem, *.key, *secret*. */
import { execSync } from 'node:child_process';

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const RULES = [
  { label: '.env', test: (file) => /(^|\/)\.env$/.test(file) },
  { label: '.env.*', test: (file) => /(^|\/)\.env\.(?!example$)/.test(file) },
  { label: '*.pem', test: (file) => file.endsWith('.pem') },
  { label: '*.key', test: (file) => file.endsWith('.key') },
  { label: '*secret*', test: (file) => /secret/i.test(file) },
];

const hits = [];
for (const file of staged) {
  for (const rule of RULES) {
    if (rule.test(file)) hits.push(`${file} (matched ${rule.label})`);
  }
}

if (hits.length > 0) {
  console.error('Pre-commit: refusing to commit secret-looking files (prompt.md §14):');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
