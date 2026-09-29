import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const home =
  process.env.NOAKS_HOME_DIR || path.resolve(root, "../noaks-vag-home");
const script = path.join(home, "BrowserTour/server.py");
try {
  await access(script);
} catch {
  console.error(
    "Set NOAKS_HOME_DIR to the existing Noaks project folder. The private scene is not bundled in Git.",
  );
  process.exit(1);
}
const child = spawn(process.env.PYTHON || "python3", [script], {
  cwd: path.dirname(script),
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
