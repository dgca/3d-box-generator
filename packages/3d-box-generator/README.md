# 3D Box Generator

Headless TypeScript library for generating simple 3D-printable box and lid meshes, plus ASCII STL output.

```ts
import {
  createBodyStl,
  createLidStl,
  DEFAULT_BOX_PARAMS,
  DEFAULT_LID_PARAMS,
} from "3d-box-generator";

const boxParams = {
  ...DEFAULT_BOX_PARAMS,
  interiorWidth: 75,
  interiorDepth: 125,
  interiorHeight: 35,
};

const bodyStl = createBodyStl({ params: boxParams });
const lidStl = createLidStl({
  boxParams,
  lidParams: {
    ...DEFAULT_LID_PARAMS,
    cutDepth: "through",
    seatStyle: "rimGroove",
  },
});
```

## Scripts

```bash
pnpm build
pnpm typecheck
```

## Notes

- Units are millimeters.
- SVG parsing is available through `parseSvgCutout`, but it relies on browser DOM APIs through Three.js `SVGLoader`.
- Non-browser callers can pass `CutoutShape` contours directly.
