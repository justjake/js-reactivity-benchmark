import { defineConfig } from "vitest/config";

// The enclosing monorepo's root vite.config.ts declares vitest "projects"
// that do not exist relative to this package, which aborts startup. A local
// config stops vitest's upward config search at this package.
export default defineConfig({});
