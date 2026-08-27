---
name: Generated API exports
description: A durable note about the workspace's generated Zod API barrel behavior.
---

The generated Zod API module is the public source for the API server's schema exports. Re-exporting the generated `types` directory alongside it can create duplicate named exports with newer Orval output.

**Why:** The generator emits overlapping body and response names in both locations, so a broad barrel re-export causes TypeScript ambiguity during the workspace build.

**How to apply:** When regenerating the API client, keep the Zod package barrel intentional and run the library typecheck immediately after codegen.