'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cli = path.join(__dirname, 'index.js');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'env-sync-example-'));
let checks = 0;

function run(args, cwd = directory) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: 'utf8'
  });
}

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

try {
  const input = [
    '# Database settings',
    '',
    'PORT=8080',
    'DEBUG=false',
    'PUBLIC_URL=https://my-company.invalid/api',
    'API_KEY=super-private',
    'ACCESS_TOKEN="a#b c" # do not remove',
    "PASSWORD='complex password'",
    'NAME=Production',
    'export SECRET_CODE = hidden',
    'EMPTY=',
    'HASH=foo#bar',
    'SPACED = value   # note',
    'NOT AN ASSIGNMENT',
    ''
  ].join('\r\n');
  const expected = [
    '# Database settings',
    '',
    'PORT=3000',
    'DEBUG=true',
    'PUBLIC_URL=https://example.com',
    'API_KEY=your_secret_key_here',
    'ACCESS_TOKEN="your_secret_key_here" # do not remove',
    "PASSWORD='your_secret_key_here'",
    'NAME=',
    'export SECRET_CODE = your_secret_key_here',
    'EMPTY=',
    'HASH=',
    'SPACED =    # note',
    'NOT AN ASSIGNMENT',
    ''
  ].join('\r\n');
  fs.writeFileSync(path.join(directory, '.env'), input);

  let result = run([]);
  check(result.status === 0, `Default CLI failed: ${result.stderr}`);
  check(fs.readFileSync(path.join(directory, '.env.example'), 'utf8') === expected,
    'Smart inference or formatting preservation failed');
  check(fs.readFileSync(path.join(directory, '.env'), 'utf8') === input,
    'Original .env was modified');

  result = run(['-i', '.env', '-o', 'custom.example', '-p', 'REPLACE_ME']);
  check(result.status === 0, `Custom placeholder failed: ${result.stderr}`);
  const custom = fs.readFileSync(path.join(directory, 'custom.example'), 'utf8');
  check(custom.includes('PORT=REPLACE_ME\r\n'), 'Numeric custom replacement failed');
  check(custom.includes('ACCESS_TOKEN="REPLACE_ME" # do not remove'),
    'Quoted custom replacement failed');
  check(custom.includes('EMPTY=REPLACE_ME\r\n'), 'Empty values must be replaced with custom text');
  check(custom.includes('# Database settings\r\n\r\n'), 'Comments or blank lines were lost');

  result = run(['--help']);
  check(result.status === 0 && result.stdout.includes('--placeholder'), 'Help failed');
  result = run(['--unexpected']);
  check(result.status !== 0 && result.stderr.includes('Unknown option'), 'Unknown option not rejected');
  result = run(['--output']);
  check(result.status !== 0 && result.stderr.includes('Missing value'), 'Missing argument not rejected');
  result = run(['-i', '.env', '-o', '.env']);
  check(result.status !== 0, 'Input overwrite was not rejected');
  result = run(['-i', 'absent.env']);
  check(result.status !== 0, 'Missing input should return a failure');
  result = run(['-p', 'bad\nvalue']);
  check(result.status !== 0, 'Newline in placeholder should be rejected');

  fs.writeFileSync(path.join(directory, 'lf.env'), 'COUNT=42\nACTIVE=TRUE\nURL=http://localhost\n');
  result = run(['--input', 'lf.env', '--output', 'lf.example']);
  check(result.status === 0, `Long options failed: ${result.stderr}`);
  check(fs.readFileSync(path.join(directory, 'lf.example'), 'utf8') ===
    'COUNT=3000\nACTIVE=true\nURL=https://example.com\n', 'LF inference failed');

  process.stdout.write(`All ${checks} tests passed.\n`);
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
