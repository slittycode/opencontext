export function normalizeCliArgs(args: string[]) {
  // yargs may skip the default $0 handler on truly empty argv in some runtime contexts.
  // Map bare invocation to "." so `opencontext` consistently routes to the TUI command.
  return args.length === 0 ? ["."] : args
}
