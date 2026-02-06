/**
 * Python type checker extension for pi
 * Runs ty (https://github.com/astral-sh/ty) on Python files after edit/write operations
 * Requires ty to be installed (e.g. `uv tool install ty` or `pipx install ty`)
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  // Check if ty is available
  const hasTy = (() => {
    try {
      execSync("command -v ty", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  if (!hasTy) {
    pi.on("session_start", async (_event, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.setStatus("ty", "ty not found — install with: uv tool install ty");
      }
    });
    return;
  }

  pi.on("tool_result", async (event, ctx) => {
    // Only check write and edit tools
    if (event.toolName !== "write" && event.toolName !== "edit") {
      return;
    }

    // Skip if tool errored
    if (event.isError) {
      return;
    }

    // Get file path from input
    const filePath = (event.input as { path?: string }).path;
    if (!filePath) {
      return;
    }

    // Only check .py files
    if (!filePath.endsWith(".py")) {
      return;
    }

    // Resolve to absolute path
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(ctx.cwd, filePath);

    // Skip if file doesn't exist
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    // Run ty check on the specific file
    const result = spawnSync(
      "ty",
      ["check", "--output-format", "concise", "--color", "never", absolutePath],
      {
        encoding: "utf-8",
        cwd: path.dirname(absolutePath),
        timeout: 30000,
      },
    );

    // Exit code 0 = no issues
    if (result.status === 0) {
      return;
    }

    // Combine stdout and stderr
    const output = ((result.stdout || "") + (result.stderr || "")).trim();
    if (!output) {
      return;
    }

    // Filter out the summary line ("Found N diagnostics")
    const lines = output
      .split("\n")
      .filter((line) => !line.startsWith("Found ") || !line.endsWith("diagnostics"));
    if (lines.length === 0) {
      return;
    }

    const feedback = `Python type errors in ${filePath}:\n${lines.join("\n")}`;

    pi.sendMessage({
      customType: "python-ty",
      content: feedback,
      display: true,
    });
  });
}
