import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC_DIR = new URL("../src/", import.meta.url);
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts"];

function isFile(file) {
  return existsSync(file) && statSync(file).isFile();
}

/** Resolve hook: `@/x` → src/x, và `./y` → `./y.ts` (hoặc `/index.ts`) khi thiếu đuôi. */
export async function resolve(specifier, context, nextResolve) {
  let base;
  if (specifier.startsWith("@/")) {
    base = new URL(specifier.slice(2), SRC_DIR);
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    base = new URL(specifier, context.parentURL);
  } else {
    return nextResolve(specifier, context);
  }
  const file = fileURLToPath(base);
  for (const suffix of CANDIDATES) {
    if (isFile(file + suffix)) return nextResolve(pathToFileURL(file + suffix).href, context);
  }
  return nextResolve(specifier, context);
}
