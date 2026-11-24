import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const [major, minor] = process.versions.node.split(".").map(Number);
const needsModernNode = major < 18 || (major === 18 && minor < 18);

const scoopNode = "C:\\Users\\Reian\\scoop\\apps\\nodejs\\current\\node.exe";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

const nodeExecutable =
  needsModernNode && fs.existsSync(scoopNode) ? scoopNode : process.execPath;

const child = spawn(nodeExecutable, [nextBin, ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: fs.existsSync(path.dirname(scoopNode))
      ? `${path.dirname(scoopNode)}${path.delimiter}${process.env.PATH || ""}`
      : process.env.PATH,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
