import { Color, ShapeUtils, Vector2 } from "three";
import {
  SVGLoader,
  type SVGResultPaths,
} from "three/examples/jsm/loaders/SVGLoader.js";
import type {
  BoxParams,
  CutoutSet,
  CutoutShape,
  FaceCutout,
  FaceName,
  ValidationIssue,
  Vec2,
} from "@/lib/types";
import { getMaxCornerChamfer, getOuterDimensions } from "@/lib/geometry/box";

export const FACE_NAMES: FaceName[] = ["front", "right", "back", "left"];

export const FACE_LABELS: Record<FaceName, string> = {
  front: "Front",
  right: "Right",
  back: "Back",
  left: "Left",
};

const DEFAULT_CUTOUT: FaceCutout = {
  enabled: false,
  margin: 6,
  scale: 0.82,
  shapes: [],
};

export function createDefaultCutouts(): CutoutSet {
  return FACE_NAMES.reduce((cutouts, face) => {
    cutouts[face] = { ...DEFAULT_CUTOUT };
    return cutouts;
  }, {} as CutoutSet);
}

export function parseSvgCutout(svgText: string): CutoutShape[] {
  const loader = new SVGLoader();
  const result = loader.parse(svgText);
  const shapes: CutoutShape[] = [];
  let compoundHoleCount = 0;

  for (const path of result.paths) {
    if (!isDarkFilledPath(path)) {
      continue;
    }

    for (const shape of SVGLoader.createShapes(path)) {
      const points = shape.extractPoints(12);
      const contour = cleanLoop(points.shape.map((point) => [point.x, point.y]));

      if (contour.length < 3 || Math.abs(getSignedArea(contour)) < 0.001) {
        continue;
      }

      compoundHoleCount += points.holes.length;
      shapes.push({ contour });
    }
  }

  if (compoundHoleCount > 0) {
    throw new Error(
      "This SVG has compound paths with internal islands. Use a simple filled silhouette for this pass.",
    );
  }

  if (shapes.length === 0) {
    throw new Error("No dark filled SVG shapes were found.");
  }

  return shapes;
}

export function validateCutouts(
  params: BoxParams,
  cutouts: CutoutSet,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dimensions = getOuterDimensions(params);
  const chamfer = Math.min(params.cornerRadius, getMaxCornerChamfer(params));

  for (const face of FACE_NAMES) {
    const cutout = cutouts[face];

    if (!cutout.enabled) {
      continue;
    }

    if (cutout.error) {
      issues.push({ face, message: cutout.error });
      continue;
    }

    if (cutout.shapes.length === 0) {
      continue;
    }

    const flatWidth =
      face === "front" || face === "back"
        ? params.interiorWidth - chamfer * 2
        : params.interiorDepth - chamfer * 2;
    const safeWidth = flatWidth - cutout.margin * 2;
    const safeHeight =
      dimensions.outerHeight - params.floorThickness - cutout.margin * 2;

    if (safeWidth <= 0 || safeHeight <= 0) {
      issues.push({
        face,
        message: `${FACE_LABELS[face]} cutout margin leaves no printable stencil area.`,
      });
    }
  }

  return issues;
}

export function getCutoutPointCount(cutout: FaceCutout): number {
  return cutout.shapes.reduce(
    (count, shape) => count + shape.contour.length,
    0,
  );
}

function isDarkFilledPath(path: SVGResultPaths): boolean {
  const style = path.userData?.style as
    | {
        display?: string;
        fill?: string;
        fillOpacity?: number | string;
        opacity?: number | string;
        visibility?: string;
      }
    | undefined;

  if (
    style?.display === "none" ||
    style?.visibility === "hidden" ||
    style?.fill === "none" ||
    Number(style?.fillOpacity ?? style?.opacity ?? 1) === 0
  ) {
    return false;
  }

  const color = getPathColor(path.color, style?.fill);
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

  return luminance < 0.5;
}

function getPathColor(color: Color | undefined, fill: string | undefined) {
  if (color) {
    return color;
  }

  if (fill) {
    try {
      return new Color(fill);
    } catch {
      return new Color("black");
    }
  }

  return new Color("black");
}

function cleanLoop(points: Vec2[]): Vec2[] {
  const cleaned: Vec2[] = [];

  for (const point of points) {
    const last = cleaned.at(-1);

    if (!last || point[0] !== last[0] || point[1] !== last[1]) {
      cleaned.push(point);
    }
  }

  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned.at(-1);

    if (last && first[0] === last[0] && first[1] === last[1]) {
      cleaned.pop();
    }
  }

  return ShapeUtils.isClockWise(cleaned.map(([x, y]) => new Vector2(x, y)))
    ? cleaned.reverse()
    : cleaned;
}

function getSignedArea(points: Vec2[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}
