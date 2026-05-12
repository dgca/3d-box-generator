# 3D Box Generator Workspace

Monorepo for the 3D Box Generator app and its publishable core library.

## Packages

- `packages/frontend`: Next.js UI for configuring boxes, previewing meshes, and downloading STL files.
- `packages/3d-box-generator`: Headless TypeScript library for generating box/lid meshes and STL strings.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

`pnpm dev` builds the library once, then starts the library watcher and frontend dev server together. `pnpm build` builds the library first, then the frontend.

## Library

The frontend imports the workspace package the same way an external consumer will:

```ts
import { createBodyStl, createLidStl } from "3d-box-generator";
```

The library is ready for local workspace consumption and emits `dist/` bundles plus TypeScript declarations. Publishing metadata is in place, but the package has not been published yet.
