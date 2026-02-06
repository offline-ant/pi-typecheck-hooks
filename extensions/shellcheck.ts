/**
 * Shell script checker extension for pi
 * Runs shellcheck on shell scripts after edit/write operations
 * Equivalent to hppr's .claude/hooks/type-check-sh.sh
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync, spawnSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  // Check if shellcheck is available
  const hasShellcheck = (() => {
    try {
      execSync("command -v shellcheck", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  })();

  if (!hasShellcheck) {
    return; // Silently skip if shellcheck not installed
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

    // Resolve to absolute path
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(ctx.cwd, filePath);

    // Skip if file doesn't exist
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    // Check if it's a shell script by reading first line
    let firstLine: string;
    try {
      const content = fs.readFileSync(absolutePath, "utf-8");
      firstLine = content.split("\n")[0] || "";
    } catch {
      return;
    }

    // Check for bash/sh shebang patterns
    const shebangPatterns = [
      /^#!.*\/bash\s*$/,
      /^#!.*\/sh\s*$/,
      /^#!.*\/env\s+(bash|sh)/,
    ];
    
    const isShellScript = shebangPatterns.some(pattern => pattern.test(firstLine));
    if (!isShellScript) {
      return;
    }

    // Run shellcheck
    const result = spawnSync("shellcheck", ["-x", "-P", "SCRIPTDIR", absolutePath], {
      encoding: "utf-8",
      cwd: path.dirname(absolutePath),
    });

    // Exit code 0 = no issues
    if (result.status === 0) {
      return;
    }

    // Combine stdout and stderr for shellcheck output
    const output = (result.stdout || "") + (result.stderr || "");
    if (!output.trim()) {
      return;
    }

    // Send feedback to the LLM via a custom message
    const feedback = `Shell errors in ${filePath}:\n${output.trim()}`;
    
    pi.sendMessage({
      customType: "shellcheck",
      content: feedback,
      display: true,
    });
  });
}
