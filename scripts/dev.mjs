// Runs the API (tsx watch) and the Vite dev server together.
import { spawn } from "node:child_process";
const procs = [
  spawn("npx", ["tsx", "watch", "server/main.ts"], { stdio: "inherit", env: process.env }),
  spawn("npx", ["vite"], { stdio: "inherit", env: process.env }),
];
const stop = () => procs.forEach((p) => p.kill("SIGINT"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => { if (code) { stop(); process.exit(code); } }));
