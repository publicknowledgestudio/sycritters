import { readFileSync } from "node:fs";
import vm from "node:vm";

// Reads index.html, pulls the marked engine <script>, runs it in an isolated
// VM context, and returns the resulting Sycritters object. This is the SAME
// source that ships in the browser — no duplication, no build step.
export function loadEngine() {
  const url = new URL("../index.html", import.meta.url);
  const html = readFileSync(url, "utf8");
  const re =
    /SYCRITTERS-ENGINE:START -->\s*<script>([\s\S]*?)<\/script>\s*<!-- SYCRITTERS-ENGINE:END/;
  const match = html.match(re);
  if (!match) throw new Error("Engine block not found in index.html");
  const ctx = vm.createContext({ console, Math });
  vm.runInContext(match[1], ctx);
  if (!ctx.Sycritters) throw new Error("Engine did not define globalThis.Sycritters");
  return ctx.Sycritters;
}
