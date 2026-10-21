# env-sync-example

![Node.js >=18](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

A tiny, **zero-dependency** Node.js CLI that turns `.env` files into shareable `.env.example` templates. It replaces values with safe type hints while preserving comments, blank lines, variable order, whitespace, quoting, and line endings.

> **Security note:** Review the generated file before committing it. Comments, variable names, and unsupported or malformed lines are preserved verbatim and might contain sensitive information. This tool is a template generator, not a secrets scanner.

## Features

- No third-party packages or runtime dependencies; Node.js 18+ only.
- Preserves comments, blank lines, ordering, LF/CRLF line endings, inline comments, and `export` prefixes.
- Infers sensible placeholders for booleans, integers, URLs, and secret-like variable names.
- Supports a custom replacement value for every assignment.
- Refuses to overwrite the input file.
- Runs on macOS, Linux, and Windows.

## Installation

Run directly from a cloned repository:

```sh
git clone https://github.com/PASSNIM/env-sync-example.git
cd env-sync-example
node index.js --help
```

Or install from a local checkout to expose the `env-sync-example` command globally:

```sh
npm install -g .
env-sync-example --help
```

No `npm install` is needed when running `node index.js` directly.

## Usage

```sh
# Read .env and write .env.example
node index.js

# Explicit paths
env-sync-example --input .env.local --output .env.local.example

# Replace every assigned value with one literal string
env-sync-example -i .env -o .env.example -p CHANGE_ME

# Show usage
env-sync-example --help
```

### CLI options

| Option | Description | Default |
| --- | --- | --- |
| `-i, --input <path>` | Input environment file | `.env` |
| `-o, --output <path>` | Output template file | `.env.example` |
| `-p, --placeholder <text>` | Use the given text for every value (including empty ones) | Smart inference |
| `-h, --help` | Show help and exit | — |

### Before and after

Input (`.env`):

```dotenv
# Server settings
PORT=8080
DEBUG=false
PUBLIC_URL=https://api.acme.test

API_KEY="very-sensitive" # server-side only
DATABASE_PASSWORD=hidden
APP_NAME=My App
```

Output (`.env.example`):

```dotenv
# Server settings
PORT=3000
DEBUG=true
PUBLIC_URL=https://example.com

API_KEY="your_secret_key_here" # server-side only
DATABASE_PASSWORD=your_secret_key_here
APP_NAME=
```

### Inference rules

Rules are evaluated in the following order (case-insensitive where applicable):

1. `true` or `false` → `true`
2. Digits only (`0`–`9`) → `3000`
3. Prefix `http://` or `https://` → `https://example.com`
4. Name contains `KEY`, `SECRET`, `TOKEN`, or `PASSWORD` → `your_secret_key_here`
5. Everything else → empty value

The original quote style is retained, including for empty replacements. Empty input values become empty output values unless `--placeholder` is set. Inline comments starting with a `#` preceded by whitespace are retained; an unquoted `#` attached to a value is part of the value. Incomplete or unsupported assignment lines are passed through unchanged.

**Custom placeholder limitations:** Line breaks and NUL are rejected. A placeholder that contains the line's original quote delimiter, or whitespace immediately followed by `#` in an unquoted assignment, is rejected to avoid breaking the generated syntax. Choose a simple value such as `CHANGE_ME` for best compatibility.

## Development

```sh
npm test
```

Tests use only built-in Node.js modules and automatically create and remove temporary fixtures. GitHub Actions validates Node.js 18.x, 20.x, and 22.x on pushes and pull requests targeting `main`.

## License

MIT © 2026 env-sync-example contributors. See [LICENSE](LICENSE).
