import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Where the user's Claude Code CLI lives. When the machine already has a
 *  logged-in `claude`, we hand its path to the Agent SDK instead of relying
 *  on the SDK's bundled binary. A server process may inherit a minimal PATH,
 *  so we probe known install locations first and fall back to asking the
 *  user's login shell. */

export interface ClaudeCliInfo {
  found: boolean;
  path: string | null;
  version: string | null;
}

const store = globalThis as unknown as { __ktiClaudeCli?: ClaudeCliInfo };

function candidatePaths(): string[] {
  const home = os.homedir();
  return [
    process.env.KTI_CLAUDE_CLI_PATH ?? "",
    path.join(home, ".claude", "local", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    path.join(home, ".local", "bin", "claude"),
  ].filter(Boolean);
}

function fromLoginShell(): string | null {
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const out = execFileSync(shell, ["-lc", "command -v claude"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out && fs.existsSync(out) ? out : null;
  } catch {
    return null;
  }
}

function readVersion(cliPath: string): string | null {
  try {
    return execFileSync(cliPath, ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function claudeCliInfo(forceRefresh = false): ClaudeCliInfo {
  if (store.__ktiClaudeCli && !forceRefresh) return store.__ktiClaudeCli;
  let resolved: string | null = null;
  for (const candidate of candidatePaths()) {
    if (fs.existsSync(candidate)) {
      resolved = candidate;
      break;
    }
  }
  resolved ??= fromLoginShell();
  store.__ktiClaudeCli = {
    found: resolved !== null,
    path: resolved,
    version: resolved ? readVersion(resolved) : null,
  };
  return store.__ktiClaudeCli;
}

/** Path to hand to the Agent SDK, or null to let it use its bundled binary. */
export function resolveClaudeCli(): string | null {
  return claudeCliInfo().path;
}
