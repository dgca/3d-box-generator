import type {
  BoxDimensions,
  BoxParams,
  MeshData,
  Triangle,
  ValidationIssue,
  Vec3,
} from "@/lib/types";

type Vec2 = [number, number];

const EPSILON = 0.000001;
const MIN_DIMENSION_MM = 1;
const MIN_THICKNESS_MM = 0.2;

export const DEFAULT_BOX_PARAMS: BoxParams = {
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

export function getMaxCornerChamfer(params: BoxParams): number {
  const width = finiteOr(params.interiorWidth, DEFAULT_BOX_PARAMS.interiorWidth);
  const depth = finiteOr(params.interiorDepth, DEFAULT_BOX_PARAMS.interiorDepth);

  return Math.max(0, Math.min(width, depth) / 4);
}

export function validateBoxParams(params: BoxParams): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const field of [
    "interiorWidth",
    "interiorDepth",
    "interiorHeight",
    "wallThickness",
    "floorThickness",
    "cornerRadius",
  ] satisfies Array<keyof BoxParams>) {
    if (!Number.isFinite(params[field])) {
      issues.push({ field, message: "Enter a number." });
    }
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

  if (Number.isFinite(params.cornerRadius) && params.cornerRadius < 0) {
    issues.push({
      field: "cornerRadius",
      message: "Cannot be negative.",
    });
  }

  const canCheckChamfer =
    Number.isFinite(params.interiorWidth) &&
    Number.isFinite(params.interiorDepth) &&
    params.interiorWidth >= MIN_DIMENSION_MM &&
    params.interiorDepth >= MIN_DIMENSION_MM;
  const maxChamfer = getMaxCornerChamfer(params);
  if (
    canCheckChamfer &&
    Number.isFinite(params.cornerRadius) &&
    params.cornerRadius > maxChamfer
  ) {
    issues.push({
      field: "cornerRadius",
      message: `Keep chamfer at or below ${formatMm(maxChamfer)} mm.`,
    });
  }

  return issues;
}

export function clampBoxParams(params: BoxParams): BoxParams {
  const next: BoxParams = {
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
    cornerRadius: Math.min(next.cornerRadius, getMaxCornerChamfer(next)),
  };
}

export function generateOpenBoxGeometry(input: BoxParams): MeshData {
  const params = clampBoxParams(input);
  const dimensions = getOuterDimensions(params);
  const zFloor = params.floorThickness;
  const zTop = dimensions.outerHeight;
  const chamfer = Math.min(params.cornerRadius, getMaxCornerChamfer(params));
  const outerLoop = chamferedRectanglePoints(
    dimensions.outerWidth,
    dimensions.outerDepth,
    chamfer,
  );
  const innerLoop = chamferedRectanglePoints(
    params.interiorWidth,
    params.interiorDepth,
    chamfer,
  );
  const outerBottom = loopAtZ(outerLoop, 0);
  const outerTop = loopAtZ(outerLoop, zTop);
  const innerFloor = loopAtZ(innerLoop, zFloor);
  const innerTop = loopAtZ(innerLoop, zTop);
  const triangles: Triangle[] = [];

  addCap(triangles, outerBottom, "down");
  addOuterWalls(triangles, outerBottom, outerTop);
  addInnerWalls(triangles, innerFloor, innerTop);
  addCap(triangles, innerFloor, "up");
  addTopRim(triangles, outerTop, innerTop);

  return { triangles, dimensions };
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

function addOuterWalls(triangles: Triangle[], bottom: Vec3[], top: Vec3[]) {
  for (let index = 0; index < bottom.length; index += 1) {
    const nextIndex = (index + 1) % bottom.length;

    triangles.push([bottom[index], bottom[nextIndex], top[nextIndex]]);
    triangles.push([bottom[index], top[nextIndex], top[index]]);
  }
}

function addInnerWalls(triangles: Triangle[], floor: Vec3[], top: Vec3[]) {
  for (let index = 0; index < floor.length; index += 1) {
    const nextIndex = (index + 1) % floor.length;

    // Inner wall normals face into the empty cavity, which is the outside of
    // the printable solid.
    triangles.push([floor[index], top[nextIndex], floor[nextIndex]]);
    triangles.push([floor[index], top[index], top[nextIndex]]);
  }
}

function addTopRim(triangles: Triangle[], outer: Vec3[], inner: Vec3[]) {
  for (let index = 0; index < outer.length; index += 1) {
    const nextIndex = (index + 1) % outer.length;

    triangles.push([outer[index], outer[nextIndex], inner[nextIndex]]);
    triangles.push([outer[index], inner[nextIndex], inner[index]]);
  }
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
