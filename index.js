#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const HELP = `env-sync-example — generate a safe .env.example from a .env file

Usage:
  env-sync-example [options]

Options:
  -i, --input <path>         Input file (default: .env)
  -o, --output <path>        Output file (default: .env.example)
  -p, --placeholder <text>   Replace every value with this text
  -h, --help                 Show this help

Examples:
  env-sync-example
  env-sync-example -i .env.local -o .env.example
  env-sync-example --placeholder CHANGE_ME
`;

function parseArguments(argv) {
  const options = { input: '.env', output: '.env.example', placeholder: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i];
    if (argument === '-h' || argument === '--help') {
      options.help = true;
      return options;
    }
    const names = {
      '-i': 'input', '--input': 'input',
      '-o': 'output', '--output': 'output',
      '-p': 'placeholder', '--placeholder': 'placeholder'
    };
    const key = names[argument];
    if (!key) {
      throw new Error(`Unknown option: ${argument}`);
    }
    if (i + 1 >= argv.length || (argv[i + 1].startsWith('-') && argv[i + 1] !== '-')) {
      throw new Error(`Missing value for ${argument}`);
    }
    options[key] = argv[++i];
  }
  if (options.input.length === 0 || options.output.length === 0) {
    throw new Error('Input and output paths cannot be empty.');
  }
  return options;
}

function inferPlaceholder(name, value) {
  if (/^(true|false)$/i.test(value)) return 'true';
  if (/^[0-9]+$/.test(value)) return '3000';
  if (/^https?:\/\//i.test(value)) return 'https://example.com';
  if (/(KEY|SECRET|TOKEN|PASSWORD)/i.test(name)) return 'your_secret_key_here';
  return '';
}

function transformLine(line, placeholder) {
  // Keep whitespace, comments, blank lines, and non-assignment text unchanged.
  const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
  if (!match) return line;

  const [, prefix, name, separator, remainder] = match;
  const trailingSpace = remainder.match(/\s*$/)[0];
  const trimmed = remainder.slice(0, remainder.length - trailingSpace.length);

  // Quoted values may contain #. Preserve the original quote character.
  const quote = trimmed[0] === '"' || trimmed[0] === "'" ? trimmed[0] : null;
  let original;
  let suffix;
  let opening = '';
  let closing = '';

  if (quote) {
    // Find an unescaped closing quote; keep any trailing inline comment untouched.
    let closeAt = -1;
    for (let i = 1; i < trimmed.length; i += 1) {
      if (trimmed[i] !== quote) continue;
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && trimmed[j] === '\\'; j -= 1) backslashes += 1;
      if (backslashes % 2 === 0) {
        closeAt = i;
        break;
      }
    }
    if (closeAt === -1 || !/^\s*(?:#.*)?$/.test(trimmed.slice(closeAt + 1))) {
      // A malformed or unsupported assignment is safer left untouched than rewritten.
      return line;
    }
    opening = quote;
    closing = quote;
    original = trimmed.slice(1, closeAt);
    suffix = trimmed.slice(closeAt + 1) + trailingSpace;
  } else {
    // An inline comment begins at # preceded by whitespace (or at the start).
    const comment = trimmed.match(/(^|\s)#/);
    const at = comment ? comment.index + comment[1].length : -1;
    const beforeComment = at < 0 ? trimmed : trimmed.slice(0, at);
    const value = beforeComment.trimEnd();
    original = value;
    suffix = beforeComment.slice(value.length) + (at < 0 ? '' : trimmed.slice(at)) + trailingSpace;
  }

  const replacement = placeholder === undefined
    ? inferPlaceholder(name, original)
    : placeholder;

  // Reject unsafe placeholder characters to keep the file single-line and parseable.
  if (opening && replacement.includes(opening)) {
    throw new Error(`Placeholder contains a quote used by ${name}.`);
  }
  if (!opening && /\s#/.test(replacement)) {
    throw new Error(`Placeholder would create an inline comment for ${name}.`);
  }
  return prefix + name + separator + opening + replacement + closing + suffix;
}

function transform(source, placeholder) {
  if (placeholder !== undefined && /[\r\n\0]/.test(placeholder)) {
    throw new Error('Placeholder cannot contain newlines or NUL characters.');
  }
  // Splitting with captured separators preserves LF, CRLF, CR, and final newlines.
  return source.split(/(\r\n|\n|\r)/).map((part, index) =>
    index % 2 === 0 ? transformLine(part, placeholder) : part
  ).join('');
}

function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const input = path.resolve(options.input);
  const output = path.resolve(options.output);
  if (input === output) throw new Error('Input and output must be different files.');
  if (fs.existsSync(output) && fs.realpathSync(output) === fs.realpathSync(input)) {
    throw new Error('Input and output must not refer to the same file.');
  }
  const contents = fs.readFileSync(input, 'utf8');
  const result = transform(contents, options.placeholder);
  fs.writeFileSync(output, result, { encoding: 'utf8', mode: 0o666 });
  process.stdout.write(`Created ${options.output}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`Error: ${error.message}\nRun with --help for usage.\n`);
  process.exitCode = 1;
}
