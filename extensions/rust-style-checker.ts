/**
 * Rust style checker extension for pi
 * Warns about String::from_utf8_lossy usage without explicit justification
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

export default function (pi: ExtensionAPI) {
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

    // Only check .rs files
    if (!filePath.endsWith(".rs")) {
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

    // Read file content
    let content: string;
    try {
      content = fs.readFileSync(absolutePath, "utf-8");
    } catch {
      return;
    }

    const lines = content.split("\n");
    const warnings: string[] = [];

    // Find all occurrences of String::from_utf8_lossy
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("String::from_utf8_lossy")) {
        continue;
      }

      // Check surrounding lines (current line, 2 lines above, 2 lines below) for "Lossy" comment
      const contextStart = Math.max(0, i - 2);
      const contextEnd = Math.min(lines.length - 1, i + 2);
      
      let hasJustification = false;
      for (let j = contextStart; j <= contextEnd; j++) {
        // Look for "UTF-8 Lossy:" or "Lossy" in comments
        if (lines[j].includes("UTF-8 Lossy:") || 
            (lines[j].includes("//") && lines[j].includes("Lossy"))) {
          hasJustification = true;
          break;
        }
      }

      if (!hasJustification) {
        warnings.push(`Line ${i + 1}: ${line.trim()}`);
      }
    }

    if (warnings.length === 0) {
      return;
    }

    // Send feedback to the LLM
    const feedback = `⚠️ Rust style warning in ${filePath}:

Found String::from_utf8_lossy without explicit justification:
${warnings.join("\n")}

String::from_utf8_lossy is almost always wrong because:
- It silently replaces invalid UTF-8 with � (replacement character)
- This hides data corruption and encoding bugs
- Usually you want String::from_utf8() with proper error handling

Unless the user has explicitly approved lossy conversion, use one of:
- String::from_utf8(bytes)? - propagate error
- String::from_utf8(bytes).map_err(|e| ...)? - custom error
- String::from_utf8_lossy() only for display/logging where data loss is acceptable

To suppress this warning, add a comment near the usage:
// UTF-8 Lossy: <reason why lossy conversion is acceptable here>

IMPORTANT: Do NOT automatically add suppression comments. If the from_utf8_lossy
call already exists in the codebase (even if you didn't write it), you must ASK
the user whether lossy conversion is acceptable before either:
1. Adding a suppression comment, or
2. Refactoring to use proper error handling`;

    pi.sendMessage({
      customType: "rust-style-checker",
      content: feedback,
      display: true,
    });
  });
}
