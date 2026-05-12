import { ShapeUtils, Vector2 } from "three";
import polygonClipping from "polygon-clipping";
import type {
  BoxDimensions,
  BoxParams,
  CornerStyle,
  CutoutSet,
  FaceCutout,
  FaceName,
  MeshData,
  Triangle,
  ValidationIssue,
  Vec2,
  Vec3,
} from "@/lib/types";

const EPSILON = 0.000001;
const MIN_DIMENSION_MM = 1;
const MIN_THICKNESS_MM = 0.2;

type PolygonRing = Vec2[];
type Polygon = PolygonRing[];
type MultiPolygon = Polygon[];

export const DEFAULT_BOX_PARAMS: BoxParams = {
  cornerStyle: "chamfer",
  interiorWidth: 75,
  interiorDepth: 125,
  interiorHeight: 35,
  wallThickness: 2,
  floorThickness: 2,
  cornerRadius: 4,
};

export function getOuterDimensions(params: BoxParams): BoxDimensions {
  return {
    outerWidth: params.interiorWidth + params.wallThickness * 2,
    outerDepth: params.interiorDepth + params.wallThickness * 2,
    outerHeight: params.interiorHeight + params.floorThickness,
  };
}

export function getMaxCornerAmount(params: BoxParams): number {
  const width = finiteOr(params.interiorWidth, DEFAULT_BOX_PARAMS.interiorWidth);
  const depth = finiteOr(params.interiorDepth, DEFAULT_BOX_PARAMS.interiorDepth);

  return Math.max(0, Math.min(width, depth) / 4);
}

export function getCornerInset(params: BoxParams): number {
  if (normalizeCornerStyle(params.cornerStyle) === "sharp") {
    return 0;
  }

  return Math.min(params.cornerRadius, getMaxCornerAmount(params));
}

export function validateBoxParams(params: BoxParams): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const field of [
    "interiorWidth",
    "interiorDepth",
    "interiorHeight",
    "wallThickness",
    "floorThickness",
  ] satisfies Array<keyof BoxParams>) {
    if (!Number.isFinite(params[field])) {
      issues.push({ field, message: "Enter a number." });
    }
  }

  if (
    normalizeCornerStyle(params.cornerStyle) !== "sharp" &&
    !Number.isFinite(params.cornerRadius)
  ) {
    issues.push({ field: "cornerRadius", message: "Enter a number." });
  }

  for (const field of [
    "interiorWidth",
    "interiorDepth",
    "interiorHeight",
  ] satisfies Array<keyof BoxParams>) {
    if (Number.isFinite(params[field]) && params[field] < MIN_DIMENSION_MM) {
      issues.push({ field, message: "Must be at least 1 mm." });
    }
  }

  for (const field of [
    "wallThickness",
    "floorThickness",
  ] satisfies Array<keyof BoxParams>) {
    if (Number.isFinite(params[field]) && params[field] < MIN_THICKNESS_MM) {
      issues.push({ field, message: "Must be at least 0.2 mm." });
    }
  }

  const shouldValidateCornerAmount =
    normalizeCornerStyle(params.cornerStyle) !== "sharp";

  if (
    shouldValidateCornerAmount &&
    Number.isFinite(params.cornerRadius) &&
    params.cornerRadius < 0
  ) {
    issues.push({
      field: "cornerRadius",
      message: "Cannot be negative.",
    });
  }

  const canCheckCornerAmount =
    Number.isFinite(params.interiorWidth) &&
    Number.isFinite(params.interiorDepth) &&
    params.interiorWidth >= MIN_DIMENSION_MM &&
    params.interiorDepth >= MIN_DIMENSION_MM;
  const maxCornerAmount = getMaxCornerAmount(params);
  if (
    canCheckCornerAmount &&
    shouldValidateCornerAmount &&
    Number.isFinite(params.cornerRadius) &&
    params.cornerRadius > maxCornerAmount
  ) {
    issues.push({
      field: "cornerRadius",
      message: `Keep corner amount at or below ${formatMm(maxCornerAmount)} mm.`,
    });
  }

  return issues;
}

export function clampBoxParams(params: BoxParams): BoxParams {
  const next: BoxParams = {
    cornerStyle: normalizeCornerStyle(params.cornerStyle),
    interiorWidth: Math.max(
      MIN_DIMENSION_MM,
      finiteOr(params.interiorWidth, DEFAULT_BOX_PARAMS.interiorWidth),
    ),
    interiorDepth: Math.max(
      MIN_DIMENSION_MM,
      finiteOr(params.interiorDepth, DEFAULT_BOX_PARAMS.interiorDepth),
    ),
    interiorHeight: Math.max(
      MIN_DIMENSION_MM,
      finiteOr(params.interiorHeight, DEFAULT_BOX_PARAMS.interiorHeight),
    ),
    wallThickness: Math.max(
      MIN_THICKNESS_MM,
      finiteOr(params.wallThickness, DEFAULT_BOX_PARAMS.wallThickness),
    ),
    floorThickness: Math.max(
      MIN_THICKNESS_MM,
      finiteOr(params.floorThickness, DEFAULT_BOX_PARAMS.floorThickness),
    ),
    cornerRadius: Math.max(
      0,
      finiteOr(params.cornerRadius, DEFAULT_BOX_PARAMS.cornerRadius),
    ),
  };

  return {
    ...next,
    cornerRadius: Math.min(next.cornerRadius, getMaxCornerAmount(next)),
  };
}

export function generateOpenBoxGeometry(
  input: BoxParams,
  cutouts?: CutoutSet,
): MeshData {
  const params = clampBoxParams(input);
  const dimensions = getOuterDimensions(params);
  const zFloor = params.floorThickness;
  const zTop = dimensions.outerHeight;
  const cornerInset = getCornerInset(params);
  const outerLoop = corneredRectanglePoints(
    dimensions.outerWidth,
    dimensions.outerDepth,
    cornerInset,
    params.cornerStyle,
  );
  const innerLoop = corneredRectanglePoints(
    params.interiorWidth,
    params.interiorDepth,
    cornerInset,
    params.cornerStyle,
  );
  const outerBottom = loopAtZ(outerLoop, 0);
  const outerTop = loopAtZ(outerLoop, zTop);
  const innerFloor = loopAtZ(innerLoop, zFloor);
  const innerTop = loopAtZ(innerLoop, zTop);
  const triangles: Triangle[] = [];

  addCap(triangles, outerBottom, "down");
  addWallsWithOptionalCutouts({
    cornerInset,
    cutouts,
    dimensions,
    innerFloor,
    innerTop,
    outerBottom,
    outerTop,
    params,
    triangles,
  });
  addCap(triangles, innerFloor, "up");
  addTopRim(triangles, outerTop, innerTop);

  return { triangles, dimensions };
}

function corneredRectanglePoints(
  width: number,
  depth: number,
  cornerInset: number,
  style: CornerStyle,
): Vec2[] {
  if (style === "rounded") {
    return roundedRectanglePoints(width, depth, cornerInset);
  }

  return chamferedRectanglePoints(width, depth, cornerInset);
}

function chamferedRectanglePoints(
  width: number,
  depth: number,
  chamfer: number,
): Vec2[] {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const c = Math.min(chamfer, halfWidth - EPSILON, halfDepth - EPSILON);

  if (c <= EPSILON) {
    return [
      [-halfWidth, -halfDepth],
      [halfWidth, -halfDepth],
      [halfWidth, halfDepth],
      [-halfWidth, halfDepth],
    ];
  }

  return [
    [-halfWidth + c, -halfDepth],
    [halfWidth - c, -halfDepth],
    [halfWidth, -halfDepth + c],
    [halfWidth, halfDepth - c],
    [halfWidth - c, halfDepth],
    [-halfWidth + c, halfDepth],
    [-halfWidth, halfDepth - c],
    [-halfWidth, -halfDepth + c],
  ];
}

function roundedRectanglePoints(
  width: number,
  depth: number,
  radius: number,
): Vec2[] {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const r = Math.min(radius, halfWidth - EPSILON, halfDepth - EPSILON);
  const segments = 8;

  if (r <= EPSILON) {
    return chamferedRectanglePoints(width, depth, 0);
  }

  const points: Vec2[] = [
    [-halfWidth + r, -halfDepth],
    [halfWidth - r, -halfDepth],
  ];

  appendArc(points, [halfWidth - r, -halfDepth + r], r, -Math.PI / 2, 0);
  points.push([halfWidth, halfDepth - r]);
  appendArc(points, [halfWidth - r, halfDepth - r], r, 0, Math.PI / 2);
  points.push([-halfWidth + r, halfDepth]);
  appendArc(points, [-halfWidth + r, halfDepth - r], r, Math.PI / 2, Math.PI);
  points.push([-halfWidth, -halfDepth + r]);
  appendArc(
    points,
    [-halfWidth + r, -halfDepth + r],
    r,
    Math.PI,
    Math.PI * 1.5,
    false,
  );

  return removeClosingPoint(points);

  function appendArc(
    target: Vec2[],
    [centerX, centerY]: Vec2,
    arcRadius: number,
    startAngle: number,
    endAngle: number,
    includeEnd = true,
  ) {
    const maxStep = includeEnd ? segments : segments - 1;

    for (let step = 1; step <= maxStep; step += 1) {
      const t = step / segments;
      const angle = startAngle + (endAngle - startAngle) * t;

      target.push([
        centerX + Math.cos(angle) * arcRadius,
        centerY + Math.sin(angle) * arcRadius,
      ]);
    }
  }
}

function loopAtZ(loop: Vec2[], z: number): Vec3[] {
  return loop.map(([x, y]) => [x, y, z]);
}

function addCap(triangles: Triangle[], loop: Vec3[], direction: "up" | "down") {
  for (let index = 1; index < loop.length - 1; index += 1) {
    if (direction === "up") {
      triangles.push([loop[0], loop[index], loop[index + 1]]);
    } else {
      triangles.push([loop[0], loop[index + 1], loop[index]]);
    }
  }
}

function addWallsWithOptionalCutouts({
  cornerInset,
  cutouts,
  dimensions,
  innerFloor,
  innerTop,
  outerBottom,
  outerTop,
  params,
  triangles,
}: {
  cornerInset: number;
  cutouts?: CutoutSet;
  dimensions: BoxDimensions;
  innerFloor: Vec3[];
  innerTop: Vec3[];
  outerBottom: Vec3[];
  outerTop: Vec3[];
  params: BoxParams;
  triangles: Triangle[];
}) {
  for (let index = 0; index < outerBottom.length; index += 1) {
    const face = getFaceForEdge(outerBottom, index);
    const cutout = face ? cutouts?.[face] : undefined;

    const didAddCutout =
      face &&
      isCutoutReady(cutout) &&
      addCutoutWallPanel(
        triangles,
        params,
        dimensions,
        cornerInset,
        face,
        cutout,
      );

    if (!didAddCutout) {
      addOuterWallEdge(triangles, outerBottom, outerTop, index);
      addInnerWallEdge(triangles, innerFloor, innerTop, index);
    }
  }
}

function addOuterWallEdge(
  triangles: Triangle[],
  bottom: Vec3[],
  top: Vec3[],
  index: number,
) {
  const nextIndex = (index + 1) % bottom.length;

  triangles.push([bottom[index], bottom[nextIndex], top[nextIndex]]);
  triangles.push([bottom[index], top[nextIndex], top[index]]);
}

function addInnerWallEdge(
  triangles: Triangle[],
  floor: Vec3[],
  top: Vec3[],
  index: number,
) {
  const nextIndex = (index + 1) % floor.length;

  // Inner wall normals face into the empty cavity, which is the outside of
  // the printable solid.
  triangles.push([floor[index], top[nextIndex], floor[nextIndex]]);
  triangles.push([floor[index], top[index], top[nextIndex]]);
}

function addCutoutWallPanel(
  triangles: Triangle[],
  params: BoxParams,
  dimensions: BoxDimensions,
  chamfer: number,
  face: FaceName,
  cutout: FaceCutout,
): boolean {
  const frame = getFaceFrame(params, dimensions, chamfer, face);
  const cutoutLoops = fitCutoutLoops(params, dimensions, frame.innerWidth, cutout);

  if (cutoutLoops.length === 0) {
    return false;
  }

  const outerContour: Vec2[] = [
    [-frame.outerWidth / 2, 0],
    [frame.outerWidth / 2, 0],
    [frame.outerWidth / 2, dimensions.outerHeight],
    [-frame.outerWidth / 2, dimensions.outerHeight],
  ];
  const innerContour: Vec2[] = [
    [-frame.innerWidth / 2, params.floorThickness],
    [frame.innerWidth / 2, params.floorThickness],
    [frame.innerWidth / 2, dimensions.outerHeight],
    [-frame.innerWidth / 2, dimensions.outerHeight],
  ];

  addTriangulatedPanel(
    triangles,
    outerContour,
    cutoutLoops,
    (point) => mapFacePoint(frame, point, frame.outerDistance),
    false,
  );
  addTriangulatedPanel(
    triangles,
    innerContour,
    cutoutLoops,
    (point) => mapFacePoint(frame, point, frame.innerDistance),
    true,
  );

  for (const loop of cutoutLoops) {
    addCutoutSideWalls(triangles, frame, loop);
  }

  return true;
}

function addTriangulatedPanel(
  triangles: Triangle[],
  contour: Vec2[],
  holes: Vec2[][],
  mapPoint: (point: Vec2) => Vec3,
  reverse: boolean,
) {
  const panelContour = ensureWinding(contour, "ccw");
  const panelHoles = holes.map((hole) => ensureWinding(hole, "cw"));
  const panelPoints = panelContour.concat(...panelHoles);
  const triangulated = ShapeUtils.triangulateShape(
    panelContour.map(toVector2),
    panelHoles.map((hole) => hole.map(toVector2)),
  );

  for (const triangle of triangulated) {
    const a = mapPoint(panelPoints[triangle[0]]);
    const b = mapPoint(panelPoints[triangle[1]]);
    const c = mapPoint(panelPoints[triangle[2]]);

    triangles.push(reverse ? [a, c, b] : [a, b, c]);
  }
}

function addCutoutSideWalls(
  triangles: Triangle[],
  frame: FaceFrame,
  loop: Vec2[],
) {
  const boundary = ensureWinding(loop, "ccw");

  for (let index = 0; index < boundary.length; index += 1) {
    const nextIndex = (index + 1) % boundary.length;
    const outerA = mapFacePoint(frame, boundary[index], frame.outerDistance);
    const outerB = mapFacePoint(frame, boundary[nextIndex], frame.outerDistance);
    const innerA = mapFacePoint(frame, boundary[index], frame.innerDistance);
    const innerB = mapFacePoint(frame, boundary[nextIndex], frame.innerDistance);

    triangles.push([outerA, outerB, innerB]);
    triangles.push([outerA, innerB, innerA]);
  }
}

function addTopRim(triangles: Triangle[], outer: Vec3[], inner: Vec3[]) {
  for (let index = 0; index < outer.length; index += 1) {
    const nextIndex = (index + 1) % outer.length;

    triangles.push([outer[index], outer[nextIndex], inner[nextIndex]]);
    triangles.push([outer[index], inner[nextIndex], inner[index]]);
  }
}

type FaceFrame = {
  innerDistance: number;
  innerWidth: number;
  normal: Vec3;
  outerDistance: number;
  outerWidth: number;
  uAxis: Vec3;
};

function getFaceFrame(
  params: BoxParams,
  dimensions: BoxDimensions,
  chamfer: number,
  face: FaceName,
): FaceFrame {
  if (face === "front") {
    return {
      innerDistance: params.interiorDepth / 2,
      innerWidth: params.interiorWidth - chamfer * 2,
      normal: [0, -1, 0],
      outerDistance: dimensions.outerDepth / 2,
      outerWidth: dimensions.outerWidth - chamfer * 2,
      uAxis: [1, 0, 0],
    };
  }

  if (face === "right") {
    return {
      innerDistance: params.interiorWidth / 2,
      innerWidth: params.interiorDepth - chamfer * 2,
      normal: [1, 0, 0],
      outerDistance: dimensions.outerWidth / 2,
      outerWidth: dimensions.outerDepth - chamfer * 2,
      uAxis: [0, 1, 0],
    };
  }

  if (face === "back") {
    return {
      innerDistance: params.interiorDepth / 2,
      innerWidth: params.interiorWidth - chamfer * 2,
      normal: [0, 1, 0],
      outerDistance: dimensions.outerDepth / 2,
      outerWidth: dimensions.outerWidth - chamfer * 2,
      uAxis: [-1, 0, 0],
    };
  }

  return {
    innerDistance: params.interiorWidth / 2,
    innerWidth: params.interiorDepth - chamfer * 2,
    normal: [-1, 0, 0],
    outerDistance: dimensions.outerWidth / 2,
    outerWidth: dimensions.outerDepth - chamfer * 2,
    uAxis: [0, -1, 0],
  };
}

function mapFacePoint(
  frame: FaceFrame,
  [u, z]: Vec2,
  distance: number,
): Vec3 {
  return [
    frame.uAxis[0] * u + frame.normal[0] * distance,
    frame.uAxis[1] * u + frame.normal[1] * distance,
    z,
  ];
}

function fitCutoutLoops(
  params: BoxParams,
  dimensions: BoxDimensions,
  flatWidth: number,
  cutout: FaceCutout,
): Vec2[][] {
  const bounds = getCutoutShapeBounds(cutout.shapes);

  if (!bounds) {
    return [];
  }

  const margin = Math.max(0, finiteOr(cutout.margin, 0));
  const safeWidth = flatWidth - margin * 2;
  const safeHeight = dimensions.outerHeight - params.floorThickness - margin * 2;

  if (safeWidth <= EPSILON || safeHeight <= EPSILON) {
    return [];
  }

  const sourceWidth = Math.max(EPSILON, bounds.maxX - bounds.minX);
  const sourceHeight = Math.max(EPSILON, bounds.maxY - bounds.minY);
  const artScale = Math.min(1, Math.max(0.05, finiteOr(cutout.scale, 1)));
  const containScale =
    Math.min(safeWidth / sourceWidth, safeHeight / sourceHeight) * artScale;
  const shouldStretch = (cutout.fitMode ?? "contain") === "stretch";
  const fitScaleX =
    shouldStretch
      ? (safeWidth / sourceWidth) * artScale
      : containScale;
  const fitScaleY =
    shouldStretch
      ? (safeHeight / sourceHeight) * artScale
      : containScale;
  const sourceCenterX = (bounds.minX + bounds.maxX) / 2;
  const sourceCenterY = (bounds.minY + bounds.maxY) / 2;
  const targetCenterZ =
    params.floorThickness + margin + safeHeight / 2;

  const fittedLoops = cutout.shapes
    .map((shape) =>
      ensureWinding(
        shape.contour.map(([x, y]) => [
          (x - sourceCenterX) * fitScaleX,
          targetCenterZ - (y - sourceCenterY) * fitScaleY,
        ]),
        "ccw",
      ),
    )
    .filter((loop) => loop.length >= 3 && Math.abs(getSignedArea(loop)) > 0.001);

  return normalizeCutoutLoops(fittedLoops);
}

function normalizeCutoutLoops(loops: Vec2[][]): Vec2[][] {
  if (loops.length === 0) {
    return [];
  }

  const polygons = loops.map((loop): Polygon => [closeLoop(loop)]);
  const result = polygonClipping.union(polygons as MultiPolygon);

  // Only exterior rings can become through-cutouts. Interior rings would make
  // floating wall islands, which are not printable as part of this one-piece box.
  return result
    .map((polygon) => polygon[0])
    .filter((ring): ring is Vec2[] => Boolean(ring))
    .map((ring) => ensureWinding(removeClosingPoint(ring), "ccw"))
    .filter((loop) => loop.length >= 3 && Math.abs(getSignedArea(loop)) > 0.001);
}

function closeLoop(loop: Vec2[]): Vec2[] {
  const first = loop[0];
  const last = loop.at(-1);

  if (last && first[0] === last[0] && first[1] === last[1]) {
    return loop;
  }

  return [...loop, first];
}

function removeClosingPoint(loop: Vec2[]): Vec2[] {
  if (loop.length <= 1) {
    return loop;
  }

  const first = loop[0];
  const last = loop.at(-1);

  if (last && first[0] === last[0] && first[1] === last[1]) {
    return loop.slice(0, -1);
  }

  return loop;
}

export function getCutoutShapeBounds(shapes: FaceCutout["shapes"]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of shapes) {
    for (const [x, y] of shape.contour) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return { maxX, maxY, minX, minY };
}

function getFaceForEdge(loop: Vec3[], index: number): FaceName | null {
  const nextIndex = (index + 1) % loop.length;
  const [x1, y1] = loop[index];
  const [x2, y2] = loop[nextIndex];

  if (Math.abs(y1 - y2) <= EPSILON && Math.abs(x1 - x2) > EPSILON) {
    return y1 < 0 ? "front" : "back";
  }

  if (Math.abs(x1 - x2) <= EPSILON && Math.abs(y1 - y2) > EPSILON) {
    return x1 > 0 ? "right" : "left";
  }

  return null;
}

function isCutoutReady(cutout: FaceCutout | undefined): cutout is FaceCutout {
  return Boolean(
    cutout?.enabled &&
      !cutout.error &&
      cutout.shapes.length > 0,
  );
}

function ensureWinding(points: Vec2[], winding: "ccw" | "cw"): Vec2[] {
  const loop = [...points];
  const isClockwise = getSignedArea(loop) < 0;

  if ((winding === "cw" && !isClockwise) || (winding === "ccw" && isClockwise)) {
    loop.reverse();
  }

  return loop;
}

function getSignedArea(points: Vec2[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function toVector2([x, y]: Vec2): Vector2 {
  return new Vector2(x, y);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeCornerStyle(style: CornerStyle | undefined): CornerStyle {
  if (style === "sharp" || style === "rounded") {
    return style;
  }

  return "chamfer";
}

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
