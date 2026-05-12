# 3D Box Generator

An MVP web app for generating simple open-top rectangular boxes and matching seated lids for 3D printing with configurable dimensions, wall structure, corner style, and SVG artwork.

The app renders a browser preview with Three.js and exports ASCII STL meshes in millimeters. Simple SVG silhouettes can be assigned to the four vertical body walls or carved into the lid top.

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

- Open-top box body and separate lid with plug-fit or rim-groove seating
- Headless core API for generating meshes and STL strings without React
- Manual mesh generation for predictable STL output
- Interior dimensions are entered in millimeters
- Corner control supports sharp, chamfered, and rounded vertical corners
- SVG cutouts on front, right, back, and left walls
- SVG artwork on the lid top plate, optionally through the underside seat
- Cutouts can be edited per face or applied to opposite face pairs
- Cutout controls show usable artwork dimensions for the selected wall
- SVG artwork can preserve proportions or stretch to the usable wall area
- Cutouts stay inside the flat wall area and away from chamfered corners
- Body and lid STL exports are separate ASCII files

## Core Library API

The UI consumes `lib/index.ts`, which is the source-level API other code can use to generate meshes or STL strings without touching React components.

```ts
import {
  createBodyStl,
  createLidStl,
  DEFAULT_BOX_PARAMS,
  DEFAULT_LID_PARAMS,
} from "@/lib";

const boxParams = {
  ...DEFAULT_BOX_PARAMS,
  interiorWidth: 75,
  interiorDepth: 125,
  interiorHeight: 35,
};

const bodyStl = createBodyStl({
  params: boxParams,
  solidName: "tarot_box_body",
});

const lidStl = createLidStl({
  boxParams,
  lidParams: {
    ...DEFAULT_LID_PARAMS,
    cutDepth: "through",
    seatStyle: "rimGroove",
  },
  solidName: "tarot_box_lid",
});
```

Useful exports include:

- `createBodyMesh`, `createLidMesh`
- `createBodyStl`, `createLidStl`
- `resolveBoxParams`, `resolveLidParams`
- `validateBodyInput`, `validateLidInput`
- `createDefaultCutout`, `createDefaultCutouts`, `parseSvgCutout`
- Shared TypeScript types such as `BoxParams`, `LidParams`, `CutoutMap`, `FaceCutout`, and `MeshData`

## Limitations

- The core API is source-level for now; npm packaging and emitted declarations are future work
- SVG parsing uses browser DOM APIs through Three.js SVGLoader; non-browser callers can pass `CutoutShape` contours directly
- Rim-groove seating uses a simple inner guide and outer skirt, not a fully recessed CAD groove
- Lid artwork can carve the top plate only or cut through the underside seat
- SVG cutouts support simple dark filled silhouettes only
- Compound SVG paths with internal islands are rejected for now
- Raster images are not traced yet; convert PNG/JPG artwork to SVG first
- No boolean operations or arbitrary CAD features
- No slicer-specific printability analysis
- Styled corners use the same corner amount on the inner and outer loops, so corner wall thickness is intentionally simple rather than CAD-offset exact

## Next Steps

- Refine rim-groove seating into a fully recessed CAD groove
- Add printability warnings for thin walls and oversized spans
- Support compound SVG paths with preserved interior islands
- Add optional raster-to-vector tracing for PNG/JPG artwork
- Consider binary STL or 3MF export once the geometry grows
