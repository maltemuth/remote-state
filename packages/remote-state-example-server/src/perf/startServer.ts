/**
 * Starts the example server in its own process for a performance run, with its
 * databases in a fresh temporary directory, and waits until it answers. Optionally
 * the process writes a CPU profile when it stops.
 */

import { spawn } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

export interface RunningServer {
  url: string;
  stop: () => Promise<void>;
}

const serverScript = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../server.js",
);

const waitUntilUp = async (url: string, attempts = 100) => {
  for (let i = 0; i < attempts; i++) {
    try {
      if ((await fetch(`${url}/battleship/api/health`)).ok) return;
    } catch {
      // Not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The server at ${url} didn't start`);
};

export const startServer = async (
  port: number,
  profileDirectory?: string,
): Promise<RunningServer> => {
  const directory = mkdtempSync(path.join(tmpdir(), "remote-state-perf-"));
  const profiling = profileDirectory
    ? ["--cpu-prof", "--cpu-prof-dir", path.resolve(profileDirectory)]
    : [];
  const child = spawn(process.execPath, [...profiling, serverScript], {
    cwd: directory,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const url = `http://localhost:${port}`;
  await waitUntilUp(url);

  const stop = async () => {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await exited;
    rmSync(directory, { recursive: true, force: true });
  };
  return { url, stop };
};
