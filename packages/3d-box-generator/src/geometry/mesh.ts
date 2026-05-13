import type { Triangle, Vec2, Vec3 } from "../types";

const EDGE_KEY_PRECISION = 6;
const POINT_ON_EDGE_EPSILON = 0.00001;
const LOOP_SIMPLIFY_EPSILON = 0.000001;
const MAX_REPAIR_PASSES = 8;

type EdgeUse = {
  a: Vec3;
  b: Vec3;
  count: number;
};

type SplitPoint = {
  point: Vec3;
  t: number;
};

export function simplifyPolygonLoop(points: Vec2[]): Vec2[] {
  const deduped: Vec2[] = [];

  for (const point of points) {
    const last = deduped.at(-1);

    if (
      !last ||
      getDistanceSquared2d(last, point) >
        LOOP_SIMPLIFY_EPSILON * LOOP_SIMPLIFY_EPSILON
    ) {
      deduped.push(point);
    }
  }

  if (
    deduped.length > 1 &&
    getDistanceSquared2d(deduped[0], deduped.at(-1)!) <=
      LOOP_SIMPLIFY_EPSILON * LOOP_SIMPLIFY_EPSILON
  ) {
    deduped.pop();
  }

  let simplified = deduped;
  let didRemovePoint = true;

  while (didRemovePoint && simplified.length >= 3) {
    didRemovePoint = false;
    const nextLoop: Vec2[] = [];

    for (let index = 0; index < simplified.length; index += 1) {
      const previous =
        simplified[(index - 1 + simplified.length) % simplified.length];
      const point = simplified[index];
      const next = simplified[(index + 1) % simplified.length];

      if (isRedundantCollinearPoint(previous, point, next)) {
        didRemovePoint = true;
        continue;
      }

      nextLoop.push(point);
    }

    simplified = nextLoop;
  }

  return simplified;
}

export function repairTJunctions(triangles: Triangle[]): Triangle[] {
  let repaired = triangles;

  for (let pass = 0; pass < MAX_REPAIR_PASSES; pass += 1) {
    const boundaryEdges = getBoundaryEdges(repaired);

    if (boundaryEdges.length === 0) {
      return repaired;
    }

    const boundaryVertices = getBoundaryVertices(boundaryEdges);
    let didSplit = false;
    const nextTriangles: Triangle[] = [];

    for (const triangle of repaired) {
      const splitTriangle = splitTriangleOnBoundaryVertex(
        triangle,
        boundaryEdges,
        boundaryVertices,
      );

      if (splitTriangle) {
        didSplit = true;
        nextTriangles.push(...splitTriangle);
      } else {
        nextTriangles.push(triangle);
      }
    }

    repaired = nextTriangles;

    if (!didSplit) {
      return repaired;
    }
  }

  return repaired;
}

function splitTriangleOnBoundaryVertex(
  triangle: Triangle,
  boundaryEdges: EdgeUse[],
  boundaryVertices: Vec3[],
): Triangle[] | null {
  const edges: Array<[Vec3, Vec3, Vec3]> = [
    [triangle[0], triangle[1], triangle[2]],
    [triangle[1], triangle[2], triangle[0]],
    [triangle[2], triangle[0], triangle[1]],
  ];

  for (const [start, end, opposite] of edges) {
    if (!isBoundaryEdge(start, end, boundaryEdges)) {
      continue;
    }

    const splitPoints = boundaryVertices
      .map((point): SplitPoint | null => {
        const t = getPointOnSegmentT(point, start, end);

        return t === null ? null : { point, t };
      })
      .filter((point): point is SplitPoint => point !== null)
      .sort((a, b) => a.t - b.t);

    if (splitPoints.length === 0) {
      continue;
    }

    const points = [start, ...splitPoints.map(({ point }) => point), end];
    const split: Triangle[] = [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const nextTriangle: Triangle = [
        points[index],
        points[index + 1],
        opposite,
      ];

      if (getTriangleAreaSquared(nextTriangle) > POINT_ON_EDGE_EPSILON ** 2) {
        split.push(nextTriangle);
      }
    }

    return split.length > 0 ? split : null;
  }

  return null;
}

function getBoundaryEdges(triangles: Triangle[]): EdgeUse[] {
  const edges = new Map<string, EdgeUse>();

  for (const triangle of triangles) {
    for (const [a, b] of [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]],
    ] satisfies Array<[Vec3, Vec3]>) {
      const key = getEdgeKey(a, b);
      const edge = edges.get(key) ?? { a, b, count: 0 };

      edge.count += 1;
      edges.set(key, edge);
    }
  }

  return [...edges.values()].filter((edge) => edge.count === 1);
}

function getBoundaryVertices(edges: EdgeUse[]): Vec3[] {
  const vertices = new Map<string, Vec3>();

  for (const edge of edges) {
    vertices.set(getVertexKey(edge.a), edge.a);
    vertices.set(getVertexKey(edge.b), edge.b);
  }

  return [...vertices.values()];
}

function isBoundaryEdge(
  start: Vec3,
  end: Vec3,
  boundaryEdges: EdgeUse[],
): boolean {
  const key = getEdgeKey(start, end);

  return boundaryEdges.some((edge) => getEdgeKey(edge.a, edge.b) === key);
}

function getPointOnSegmentT(
  point: Vec3,
  start: Vec3,
  end: Vec3,
): number | null {
  const segment = subtract(end, start);
  const segmentLengthSquared = dot(segment, segment);

  if (segmentLengthSquared <= POINT_ON_EDGE_EPSILON ** 2) {
    return null;
  }

  const t = dot(subtract(point, start), segment) / segmentLengthSquared;

  if (t <= POINT_ON_EDGE_EPSILON || t >= 1 - POINT_ON_EDGE_EPSILON) {
    return null;
  }

  const closest: Vec3 = [
    start[0] + segment[0] * t,
    start[1] + segment[1] * t,
    start[2] + segment[2] * t,
  ];
  const distanceSquared = dot(subtract(point, closest), subtract(point, closest));
  const toleranceSquared =
    POINT_ON_EDGE_EPSILON ** 2 * Math.max(1, segmentLengthSquared);

  return distanceSquared <= toleranceSquared ? t : null;
}

function getTriangleAreaSquared([a, b, c]: Triangle): number {
  const crossProduct = cross(subtract(b, a), subtract(c, a));

  return dot(crossProduct, crossProduct) / 4;
}

function getEdgeKey(a: Vec3, b: Vec3): string {
  const aKey = getVertexKey(a);
  const bKey = getVertexKey(b);

  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function getVertexKey(vertex: Vec3): string {
  return vertex
    .map((value) => value.toFixed(EDGE_KEY_PRECISION))
    .join(",");
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function isRedundantCollinearPoint(
  previous: Vec2,
  point: Vec2,
  next: Vec2,
): boolean {
  const previousVector: Vec2 = [
    point[0] - previous[0],
    point[1] - previous[1],
  ];
  const nextVector: Vec2 = [next[0] - point[0], next[1] - point[1]];
  const crossProduct =
    previousVector[0] * nextVector[1] - previousVector[1] * nextVector[0];
  const dotProduct =
    previousVector[0] * nextVector[0] + previousVector[1] * nextVector[1];
  const lengthScale = Math.max(
    1,
    Math.hypot(previousVector[0], previousVector[1]),
    Math.hypot(nextVector[0], nextVector[1]),
  );

  return (
    Math.abs(crossProduct) <= LOOP_SIMPLIFY_EPSILON * lengthScale &&
    dotProduct >= -LOOP_SIMPLIFY_EPSILON
  );
}

function getDistanceSquared2d(a: Vec2, b: Vec2): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}
