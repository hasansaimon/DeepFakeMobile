---
name: Generated API exports
description: A durable note about the workspace's generated Zod API barrel behavior.
---

The generated Zod API module is the public source for the API server's schema exports. Re-exporting the generated `types` directory alongside it can create duplicate named exports with newer Orval output.

**Why:** The generator emits overlapping body and response names in both locations, so a broad barrel re-export causes TypeScript ambiguity during the workspace build.

**How to apply:** When regenerating the API client, keep the Zod package barrel intentional and run the library typecheck immediately after codegen.

With Orval 8.38+, disable `output.indexFiles` for the Zod target. Otherwise codegen rewrites the package barrel to re-export generated TypeScript schemas alongside the Zod schemas, recreating the duplicate-export error. The React client may also need `dom.iterable` when newer output uses `Headers.entries()`.

**Why:** The newer generator emits a workspace barrel and relies on iterable DOM typings that were not part of this workspace's existing TypeScript lib set.

**How to apply:** Keep the deliberate Zod barrel and include `dom.iterable` in the React client's compiler libs when upgrading Orval.