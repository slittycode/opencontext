export interface TuiSupportInput {
  stdinTTY: boolean
  stdoutTTY: boolean
  term?: string
}

export interface TuiSupportResult {
  ok: boolean
  reason?: string
}

export function checkTuiSupport(input: TuiSupportInput): TuiSupportResult {
  if (!input.stdinTTY || !input.stdoutTTY) {
    return {
      ok: false,
      reason: "OpenContext TUI requires an interactive terminal (stdin/stdout TTY).",
    }
  }

  const term = (input.term ?? "").trim().toLowerCase()
  if (!term || term === "dumb") {
    return {
      ok: false,
      reason: 'OpenContext TUI requires a terminal that supports full-screen apps (TERM must not be "dumb").',
    }
  }

  return { ok: true }
}

export function restoreTerminalState() {
  try {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      process.stdin.setRawMode(false)
    }
  } catch {}

  try {
    // Best-effort reset for alternate screen, mouse reporting, bracketed paste, kitty keyboard and cursor visibility.
    process.stdout.write("\x1b[>4;0m\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?2004l\x1b[?1049l\x1b[?25h")
  } catch {}
}
