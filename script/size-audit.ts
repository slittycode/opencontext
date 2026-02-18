#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs"
import path from "path"

type FamilyUsage = {
  key: string
  kb: number
}

type BunUsage = {
  name: string
  kb: number
}

const repoRoot = path.resolve(import.meta.dir, "..")
process.chdir(repoRoot)

const jsonOnly = process.argv.includes("--json")

const dependencyFamilies = [
  "@esbuild+",
  "@cloudflare+workerd",
  "sst-",
  "@tauri-apps+cli-",
  "@pagefind+",
  "turbo-",
  "@typescript+native-preview",
  "@img+sharp",
  "typescript@",
  "@ibm+plex",
]

function formatMb(kb: number) {
  return (kb / 1024).toFixed(1)
}

function parseDuOutput(output: string) {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(.+)$/)
      if (!match) return undefined
      return {
        kb: Number(match[1]) || 0,
        path: match[2],
      }
    })
    .filter((value): value is { kb: number; path: string } => value !== undefined)
}

async function duKb(target: string) {
  if (!fs.existsSync(target)) return 0
  const result = await $`du -sk ${target}`.nothrow().quiet()
  if (result.exitCode !== 0) return 0
  const first = result.stdout.toString("utf8").trim().split(/\s+/)[0]
  return Number(first) || 0
}

function getBunBuildStats() {
  const opencodeDir = path.join(repoRoot, "packages", "opencode")
  if (!fs.existsSync(opencodeDir)) {
    return { count: 0, kb: 0 }
  }

  let count = 0
  let bytes = 0
  for (const entry of fs.readdirSync(opencodeDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!entry.name.startsWith(".")) continue
    if (!entry.name.endsWith(".bun-build")) continue

    const fullPath = path.join(opencodeDir, entry.name)
    const stats = fs.statSync(fullPath)
    count += 1
    bytes += stats.size
  }

  return {
    count,
    kb: Math.ceil(bytes / 1024),
  }
}

async function getBunUsage() {
  const bunDir = path.join(repoRoot, "node_modules", ".bun")
  if (!fs.existsSync(bunDir)) return [] as BunUsage[]

  const result = await $`find node_modules/.bun -mindepth 1 -maxdepth 1 -type d -print0 | xargs -0 du -sk`.nothrow().quiet()
  if (result.exitCode !== 0) return [] as BunUsage[]

  const parsed = parseDuOutput(result.stdout.toString("utf8"))
  return parsed.map((item) => ({
    name: path.basename(item.path),
    kb: item.kb,
  }))
}

function getFamilyUsage(usage: BunUsage[]): FamilyUsage[] {
  return dependencyFamilies.map((family) => ({
    key: family,
    kb: usage.reduce((sum, item) => (item.name.includes(family) ? sum + item.kb : sum), 0),
  }))
}

function printHumanSummary(input: {
  repoTotalKb: number
  nodeModulesBunKb: number
  opencodeBunBuildKb: number
  opencodeBunBuildCount: number
  opencodeDistKb: number
  familyUsage: FamilyUsage[]
  topPackages: BunUsage[]
}) {
  console.log("OpenContext size audit")
  console.log(`repo_total_kb: ${input.repoTotalKb} (${formatMb(input.repoTotalKb)} MB)`)
  console.log(`node_modules_bun_kb: ${input.nodeModulesBunKb} (${formatMb(input.nodeModulesBunKb)} MB)`)
  console.log(
    `opencode_bun_build_kb: ${input.opencodeBunBuildKb} (${formatMb(input.opencodeBunBuildKb)} MB), files=${input.opencodeBunBuildCount}`,
  )
  console.log(`opencode_dist_kb: ${input.opencodeDistKb} (${formatMb(input.opencodeDistKb)} MB)`)
  console.log("")
  console.log("dependency_families_kb:")
  for (const family of input.familyUsage) {
    if (family.kb === 0) continue
    console.log(`  ${family.key}: ${family.kb} (${formatMb(family.kb)} MB)`)
  }
  console.log("")
  console.log("top_bun_packages_kb:")
  for (const pkg of input.topPackages.slice(0, 10)) {
    console.log(`  ${pkg.name}: ${pkg.kb} (${formatMb(pkg.kb)} MB)`)
  }
  console.log("")
}

const [repoTotalKb, nodeModulesBunKb, opencodeDistKb, bunUsage] = await Promise.all([
  duKb("."),
  duKb("node_modules/.bun"),
  duKb("packages/opencode/dist"),
  getBunUsage(),
])

const bunBuildStats = getBunBuildStats()
const familyUsage = getFamilyUsage(bunUsage)
const topPackages = [...bunUsage].sort((a, b) => b.kb - a.kb)

const report = {
  timestamp: new Date().toISOString(),
  repo_root: repoRoot,
  repo_total_kb: repoTotalKb,
  node_modules_bun_kb: nodeModulesBunKb,
  opencode_bun_build_kb: bunBuildStats.kb,
  opencode_bun_build_count: bunBuildStats.count,
  opencode_dist_kb: opencodeDistKb,
  dependency_families: familyUsage,
  top_bun_packages: topPackages.slice(0, 25),
}

if (!jsonOnly) {
  printHumanSummary({
    repoTotalKb,
    nodeModulesBunKb,
    opencodeBunBuildKb: bunBuildStats.kb,
    opencodeBunBuildCount: bunBuildStats.count,
    opencodeDistKb,
    familyUsage,
    topPackages,
  })
}

console.log(JSON.stringify(report, null, 2))
