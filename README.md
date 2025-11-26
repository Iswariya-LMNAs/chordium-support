# Chordium Support

This VS Code extension provides automation and helper commands for the `lenscloud` CLI and Chordium workflows.  
It detects and uses a bundled Node 20 runtime internally, supports interactive CLI prompts, and triggers automated tasks based on file changes or saves.

## Features

- Uses bundled Node.js v20 runtime.
- Detects and runs `lenscloud` CLI reliably across all platforms.
- Shows clean formatted logs in an Output Channel.
- Supports prompt handling for interactive questions from the CLI.
- Auto-executes commands based on workspace configuration.
- Branch selection UI for reference table updates.

## Commands

The extension reads custom commands from: chordiumSupport.commands

Each command supports:
- `command`: the lenscloud command to run
- `trigger`: `"onSave"` or `"onChange"`
- `folders`: List of folders the rule applies to
- `branches`: Array of branch names for popup selection

## Requirements

- Workspace must contain a valid git repo.
- `lenscloud` must be installed globally or available in PATH (extension finder covers both).

## Extension Settings

This extension contributes the following setting:

- `chordiumSupport.commands`: Array of workflow automation commands.

## Release Notes

### 0.0.1
Initial release with Node20 runtime integration and lenscloud automation.
