'use strict';

const { spawnSync } = require('child_process');

const mode = process.argv[2] || 'taxi';
const allowedModes = new Set(['taxi', 'wimi']);

if (!allowedModes.has(mode)) {
  console.error(`Unknown build mode "${mode}". Expected "taxi" or "wimi".`);
  process.exit(2);
}

const nodeOptions = (process.env.NODE_OPTIONS || '')
  .split(/\s+/)
  .filter(Boolean);

if (!nodeOptions.includes('--openssl-legacy-provider')) {
  nodeOptions.push('--openssl-legacy-provider');
}

const env = {
  ...process.env,
  BUILD_MODE: mode,
  REACT_APP_BUILD_MODE: mode,
  NODE_OPTIONS: nodeOptions.join(' '),
};

function run(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

// Preserve the existing pre-build step and webpack pipeline, but pass the
// selected mode to both child processes so paths/env are consistent.
run('pre-build.js');
run('scripts/build.js');
