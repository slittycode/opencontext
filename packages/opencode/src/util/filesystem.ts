import { realpathSync } from "fs"
import { basename, dirname, isAbsolute, join, relative, resolve } from "path"

export namespace Filesystem {
  export const exists = (p: string) =>
    Bun.file(p)
      .stat()
      .then(() => true)
      .catch(() => false)

  export const isDir = (p: string) =>
    Bun.file(p)
      .stat()
      .then((s) => s.isDirectory())
      .catch(() => false)
  /**
   * On Windows, normalize a path to its canonical casing using the filesystem.
   * This is needed because Windows paths are case-insensitive but LSP servers
   * may return paths with different casing than what we send them.
   */
  export function normalizePath(p: string): string {
    if (process.platform !== "win32") return p
    try {
      return realpathSync.native(p)
    } catch {
      return p
    }
  }
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b)
    const relB = relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  export function contains(parent: string, child: string) {
    const parentAbsolute = resolve(parent)
    const childAbsolute = resolve(child)
    if (!containsLexical(parentAbsolute, childAbsolute)) return false

    const canonicalParent = canonicalize(parentAbsolute)
    const canonicalChild = canonicalize(childAbsolute)
    return containsLexical(canonicalParent, canonicalChild)
  }

  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      const search = join(current, target)
      if (await exists(search)) result.push(search)
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    const { targets, start, stop } = options
    let current = start
    while (true) {
      for (const target of targets) {
        const search = join(current, target)
        if (await exists(search)) yield search
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      try {
        const glob = new Bun.Glob(pattern)
        for await (const match of glob.scan({
          cwd: current,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
          dot: true,
        })) {
          result.push(match)
        }
      } catch {
        // Skip invalid glob patterns
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  function containsLexical(parent: string, child: string) {
    const rel = relative(parent, child)
    if (rel === "") return true
    if (rel.startsWith("..")) return false
    if (isAbsolute(rel)) return false
    return true
  }

  function canonicalize(input: string) {
    const absolute = resolve(input)
    const missing: string[] = []
    let probe = absolute
    while (true) {
      try {
        const resolved = realpathSync.native(probe)
        return missing.length === 0 ? resolved : join(resolved, ...missing)
      } catch {
        const parent = dirname(probe)
        if (parent === probe) return absolute
        missing.unshift(basename(probe))
        probe = parent
      }
    }
  }
}
