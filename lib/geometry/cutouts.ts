import { Color, ShapeUtils, Vector2 } from "three";
import {
  SVGLoader,
  type SVGResultPaths,
} from "three/examples/jsm/loaders/SVGLoader.js";
import type {
  BoxParams,
  CutoutSet,
  CutoutShape,
  CutoutTarget,
  FaceCutout,
  FaceName,
  ValidationIssue,
  Vec2,
} from "@/lib/types";
import {
  getCutoutShapeBounds,
  getMaxCornerChamfer,
  getOuterDimensions,
} from "@/lib/geometry/box";

export const FACE_NAMES: FaceName[] = ["front", "right", "back", "left"];
export const CUTOUT_PAIR_NAMES = ["frontBack", "leftRight"] as const;

export const FACE_LABELS: Record<FaceName, string> = {
  front: "Front",
  right: "Right",
  back: "Back",
  left: "Left",
};

export const CUTOUT_PAIR_LABELS: Record<(typeof CUTOUT_PAIR_NAMES)[number], string> = {
  frontBack: "Front / Back",
  leftRight: "Left / Right",
};

export const CUTOUT_PAIR_FACES: Record<
  (typeof CUTOUT_PAIR_NAMES)[number],
  [FaceName, FaceName]
> = {
  frontBack: ["front", "back"],
  leftRight: ["left", "right"],
};

const DEFAULT_CUTOUT: FaceCutout = {
  enabled: false,
  fitMode: "contain",
  margin: 6,
  scale: 0.82,
  shapes: [],
};

const MIN_CUTOUT_SCALE = 0.05;

export function createDefaultCutouts(): CutoutSet {
  return FACE_NAMES.reduce((cutouts, face) => {
    cutouts[face] = { ...DEFAULT_CUTOUT };
    return cutouts;
  }, {} as CutoutSet);
}

export function getCutoutTargetFaces(target: CutoutTarget): FaceName[] {
  if (target === "frontBack" || target === "leftRight") {
    return CUTOUT_PAIR_FACES[target];
  }

  return [target];
}

export function getCutoutTargetLabel(target: CutoutTarget): string {
  if (target === "frontBack" || target === "leftRight") {
    return CUTOUT_PAIR_LABELS[target];
  }

  return FACE_LABELS[target];
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

export function getCutoutDesignMetrics(
  params: BoxParams,
  face: FaceName,
  cutout: FaceCutout,
) {
  const dimensions = getOuterDimensions(params);
  const chamfer = Math.min(params.cornerRadius, getMaxCornerChamfer(params));
  const flatWidth =
    face === "front" || face === "back"
      ? params.interiorWidth - chamfer * 2
      : params.interiorDepth - chamfer * 2;
  const margin = Math.max(0, finiteOr(cutout.margin, 0));
  const usableWidth = Math.max(0, flatWidth - margin * 2);
  const usableHeight = Math.max(
    0,
    dimensions.outerHeight - params.floorThickness - margin * 2,
  );
  const bounds = getCutoutShapeBounds(cutout.shapes);

  if (!bounds || usableWidth === 0 || usableHeight === 0) {
    return {
      face,
      placedHeight: null,
      placedWidth: null,
      sourceHeight: null,
      sourceWidth: null,
      usableHeight,
      usableWidth,
    };
  }

  const sourceWidth = Math.max(0, bounds.maxX - bounds.minX);
  const sourceHeight = Math.max(0, bounds.maxY - bounds.minY);

  if (sourceWidth === 0 || sourceHeight === 0) {
    return {
      face,
      placedHeight: null,
      placedWidth: null,
      sourceHeight,
      sourceWidth,
      usableHeight,
      usableWidth,
    };
  }

  const artScale = getCutoutArtScale(cutout);
  const containScale =
    Math.min(usableWidth / sourceWidth, usableHeight / sourceHeight) * artScale;
  const shouldStretch = (cutout.fitMode ?? "contain") === "stretch";
  const scaleX =
    shouldStretch
      ? (usableWidth / sourceWidth) * artScale
      : containScale;
  const scaleY =
    shouldStretch
      ? (usableHeight / sourceHeight) * artScale
      : containScale;

  return {
    face,
    placedHeight: sourceHeight * scaleY,
    placedWidth: sourceWidth * scaleX,
    sourceHeight,
    sourceWidth,
    usableHeight,
    usableWidth,
  };
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

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function getCutoutArtScale(cutout: FaceCutout) {
  return Math.min(1, Math.max(MIN_CUTOUT_SCALE, finiteOr(cutout.scale, 1)));
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
