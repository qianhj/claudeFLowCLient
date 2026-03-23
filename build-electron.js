#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const root = 'd:\\hz-cc-flow-src';
const electronDir = path.join(root, 'electron');

function run(cmd, cwd) {
  console.log(`\n>>> ${cmd} (in ${cwd || '.'})`);
  execSync(cmd, { cwd: cwd || electronDir, stdio: 'inherit', shell: true });
}

try {
  // Step 1: install electron deps
  run('npm install', electronDir);

  // Step 2: tsc (dist/main.js already exists, but recompile to be safe)
  run('.\\node_modules\\.bin\\tsc.CMD', electronDir);

  // Step 3: electron-builder pack
  run('.\\node_modules\\.bin\\electron-builder.CMD --config electron-builder.yml', electronDir);

  console.log('\n=== SUCCESS! Output: C:\\HzBuild\\release ===');
} catch (e) {
  console.error('\n=== FAILED:', e.message);
  process.exit(1);
}
