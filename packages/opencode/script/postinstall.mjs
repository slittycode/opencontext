#!/usr/bin/env node

import fs from "fs"
import os from "os"
import path from "path"
import { createRequire } from "module"
import { spawnSync } from "child_process"

const require = createRequire(import.meta.url)

function platformName() {
  return os.platform() === "win32" ? "windows" : os.platform()
}

function archName() {
  switch (os.arch()) {
    case "x64":
      return "x64"
    case "arm64":
      return "arm64"
    default:
      return os.arch()
  }
}

function hasAvx2() {
  if (os.arch() !== "x64") return true
  if (os.platform() === "linux") {
    try {
      return fs.readFileSync("/proc/cpuinfo", "utf8").toLowerCase().includes("avx2")
    } catch {
      return true
    }
  }
  if (os.platform() === "darwin") {
    try {
      const result = spawnSync("sysctl", ["-n", "hw.optional.avx2_0"], { encoding: "utf8" })
      return result.status === 0 && result.stdout.trim() === "1"
    } catch {
      return true
    }
  }
  return true
}

function isMusl() {
  if (os.platform() !== "linux") return false
  try {
    const report = process.report?.getReport?.()
    if (report && report.header && "glibcVersionRuntime" in report.header) {
      return !report.header.glibcVersionRuntime
    }
  } catch {}
  try {
    return fs.readFileSync("/usr/bin/ldd", "utf8").toLowerCase().includes("musl")
  } catch {
    return false
  }
}

function packageCandidates() {
  const platform = platformName()
  const arch = archName()
  const base = `opencontext-${platform}-${arch}`
  const candidates = []
  const musl = isMusl()
  const avx2 = hasAvx2()

  if (platform === "linux" && arch === "x64") {
    if (musl) {
      candidates.push(`${base}-musl`)
      if (!avx2) candidates.push(`${base}-baseline-musl`)
    }
    candidates.push(base)
    if (!avx2) candidates.push(`${base}-baseline`)
    if (!musl) {
      candidates.push(`${base}-musl`)
      candidates.push(`${base}-baseline-musl`)
    }
  } else if (platform === "linux" && arch === "arm64") {
    if (musl) candidates.push(`${base}-musl`)
    candidates.push(base)
    if (!musl) candidates.push(`${base}-musl`)
  } else if (platform === "darwin" && arch === "x64") {
    candidates.push(base)
    candidates.push(`${base}-baseline`)
  } else if (platform === "windows" && arch === "x64") {
    candidates.push(base)
    candidates.push(`${base}-baseline`)
  } else {
    candidates.push(base)
  }

  return [...new Set(candidates)]
}

function findBinary() {
  const binaryName = platformName() === "windows" ? "opencontext.exe" : "opencontext"

  for (const packageName of packageCandidates()) {
    try {
      const packageJsonPath = require.resolve(`${packageName}/package.json`)
      const packageDir = path.dirname(packageJsonPath)
      const binaryPath = path.join(packageDir, "bin", binaryName)
      if (fs.existsSync(binaryPath)) return { packageName, binaryPath }
    } catch {}
  }

  throw new Error(`Could not find a platform package. Tried: ${packageCandidates().join(", ")}`)
}

function main() {
  const { packageName, binaryPath } = findBinary()
  console.log(`Verified OpenContext runtime package: ${packageName}`)
  console.log(`Platform binary verified at: ${binaryPath}`)
}

try {
  main()
} catch (error) {
  console.error("Failed to setup opencontext binary:", error.message)
  process.exit(1)
}
