/**
 * Summarizes a CPU profile written by `npm run perf -- --profile dir`: where the
 * sampled time went, by package and by function, counting each function's own
 * time and the time of everything it called.
 *
 *   npm run perf:profile -- dir/CPU.….cpuprofile [--top 25]
 */

import { readFileSync } from "fs";
import { parseArgs } from "util";

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}

interface Profile {
  nodes: ProfileNode[];
  samples: number[];
  timeDeltas: number[];
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { top: { type: "string", default: "25" } },
});
if (positionals.length !== 1) throw new Error("Pass one .cpuprofile file");
const top = Number(values.top);
const profile = JSON.parse(readFileSync(positionals[0], "utf8")) as Profile;

const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const parents = new Map<number, number>();
for (const node of profile.nodes) {
  for (const child of node.children ?? []) parents.set(child, node.id);
}

const functionOf = ({
  callFrame: { functionName, url, lineNumber },
}: ProfileNode) =>
  `${functionName || "(anonymous)"} ${url.split("/").slice(-2).join("/")}:${lineNumber + 1}`;

const packageOf = ({ callFrame: { functionName, url } }: ProfileNode) => {
  const dependency = url.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (dependency) return dependency[1];
  if (url.includes("/packages/remote-state/")) return "remote-state";
  if (url.includes("/packages/remote-state-example-server/")) return "example";
  if (url.startsWith("node:")) return "node";
  return functionName || "(native)";
};

const own = new Map<string, number>();
const byPackage = new Map<string, number>();
const inclusive = new Map<string, number>();
const add = (totals: Map<string, number>, key: string, time: number) =>
  totals.set(key, (totals.get(key) ?? 0) + time);

let total = 0;
profile.samples.forEach((id, index) => {
  const time = profile.timeDeltas[index] ?? 0;
  const node = nodes.get(id)!;
  total += time;
  add(own, functionOf(node), time);
  add(byPackage, packageOf(node), time);
  // Each function once per sample, however often it's on the stack
  const onStack = new Set<string>();
  for (
    let at: number | undefined = id;
    at !== undefined;
    at = parents.get(at)
  ) {
    onStack.add(functionOf(nodes.get(at)!));
  }
  onStack.forEach((key) => add(inclusive, key, time));
});

const print = (title: string, totals: Map<string, number>) => {
  process.stdout.write(`\n${title}\n`);
  [...totals]
    .sort(([, a], [, b]) => b - a)
    .slice(0, top)
    .forEach(([key, time]) => {
      const share = ((100 * time) / total).toFixed(1).padStart(5);
      const seconds = (time / 1e6).toFixed(2).padStart(6);
      process.stdout.write(`${share}%  ${seconds} s  ${key}\n`);
    });
};

process.stdout.write(`${(total / 1e6).toFixed(1)} s sampled\n`);
print("Own time by package", byPackage);
print("Own time by function", own);
print("Time including calls", inclusive);
