# pi-typecheck-hooks

Type and style checking hooks for [pi](https://github.com/badlogic/pi-mono). Runs checks on files after write/edit operations and sends feedback to the LLM.

## Hooks

### shellcheck
Runs [shellcheck](https://www.shellcheck.net/) on shell scripts (bash/sh) after edit/write. Requires `shellcheck` to be installed; silently skips if not available.

### rust-style-checker
Warns about `String::from_utf8_lossy` usage in Rust files without explicit justification comments.

## Installation

Add to your pi settings (`~/.pi/agent/settings.json`):

```json
{
  "packages": [
    "/path/to/pi-typecheck-hooks"
  ]
}
```
