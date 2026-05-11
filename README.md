# 3D Printable Parametric Box Generator

An MVP web app for generating simple open-top rectangular boxes for 3D printing. The first target use case is a tarot card box with configurable interior dimensions, wall thickness, floor thickness, and vertical corner chamfer.

The app renders a browser preview with Three.js and exports an ASCII STL mesh in millimeters.

## Commands

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Create a production build:

```bash
pnpm build
```

Run linting:

```bash
pnpm lint
```

## Current Scope

- Open-top box body only
- Manual mesh generation for predictable STL output
- Interior dimensions are entered in millimeters
- Corner control is a chamfer, not a true rounded fillet
- STL export is ASCII for readability

## Limitations

- No lid generation yet
- No SVG cutout support yet
- No boolean operations or arbitrary CAD features
- No slicer-specific printability analysis
- Chamfered corners use the same chamfer value on the inner and outer loops, so corner wall thickness is intentionally simple rather than CAD-offset exact

## Next Steps

- Add a lid option with configurable clearance
- Add printability warnings for thin walls and oversized spans
- Add a constrained SVG silhouette cutout on the front face
- Add separate STL exports for body and lid
- Consider binary STL or 3MF export once the geometry grows
