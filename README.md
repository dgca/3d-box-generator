# 3D Box Generator

An MVP web app for generating simple open-top rectangular boxes for 3D printing with configurable interior dimensions, wall thickness, floor thickness, and corner style.

The app renders a browser preview with Three.js and exports an ASCII STL mesh in millimeters. Simple SVG silhouettes can be assigned to the four vertical walls and are generated as real through-cutouts in the exported mesh.

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
- Corner control supports sharp, chamfered, and rounded vertical corners
- SVG cutouts on front, right, back, and left walls
- Cutouts can be edited per face or applied to opposite face pairs
- Cutout controls show usable artwork dimensions for the selected wall
- SVG artwork can preserve proportions or stretch to the usable wall area
- Cutouts stay inside the flat wall area and away from chamfered corners
- STL export is ASCII for readability

## Limitations

- No lid generation yet
- SVG cutouts support simple dark filled silhouettes only
- Compound SVG paths with internal islands are rejected for now
- Raster images are not traced yet; convert PNG/JPG artwork to SVG first
- No boolean operations or arbitrary CAD features
- No slicer-specific printability analysis
- Styled corners use the same corner amount on the inner and outer loops, so corner wall thickness is intentionally simple rather than CAD-offset exact

## Next Steps

- Add a lid option with configurable clearance
- Add printability warnings for thin walls and oversized spans
- Support compound SVG paths with preserved interior islands
- Add optional raster-to-vector tracing for PNG/JPG artwork
- Add separate STL exports for body and lid
- Consider binary STL or 3MF export once the geometry grows
