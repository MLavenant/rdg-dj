#!/usr/bin/env node
/**
 * Master local validation — run before ship. No push. Restores any test data touched.
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const scripts = [
  'test-sched-guards.js',
  'test-dj-status-isolation.cjs',
  'test-dj-rename-isolation.cjs',
  'validate-calendar-parity.cjs',
  'two-session-oct2027-e2e.cjs',
  'two-session-mila-e2e.cjs'
];

let failed = 0;
console.log('=== RDG schedule validation suite ===\n');

for (const s of scripts) {
  const p = path.join(__dirname, s);
  console.log('--- ' + s + ' ---');
  const r = spawnSync(process.execPath, [p], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  if (r.status !== 0) {
    failed++;
    console.error('FAILED: ' + s + '\n');
  } else {
    console.log('OK: ' + s + '\n');
  }
}

console.log('=== SUITE: ' + (scripts.length - failed) + '/' + scripts.length + ' passed ===');
if (failed) process.exit(1);
