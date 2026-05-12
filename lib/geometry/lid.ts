import { ShapeUtils, Vector2 } from "three";
import polygonClipping from "polygon-clipping";
import type {
  BoxParams,
  LidCutout,
  LidField,
  LidParams,
  MeshData,
  Triangle,
  ValidationIssue,
  Vec2,
  Vec3,
} from "../types";
import {
  clampBoxParams,
  getCorneredRectanglePoints,
  getCornerInset,
  getCutoutShapeBounds,
  getOuterDimensions,
} from "./box";

const EPSILON = 0.000001;
const MIN_THICKNESS_MM = 0.2;
const MIN_CUTOUT_SCALE = 0.05;

type PolygonRing = Vec2[];
type ClipPolygon = PolygonRing[];
type MultiPolygon = ClipPolygon[];
type PositiveLidField = Extract<LidField, "plugDepth" | "topThickness">;

const NUMERIC_LID_FIELDS: LidField[] = [
  "clearance",
  "overhang",
  "plugDepth",
  "topThickness",
];
const POSITIVE_LID_FIELDS: PositiveLidField[] = ["plugDepth", "topThickness"];

export const DEFAULT_LID_PARAMS: LidParams = {
  clearance: 0.3,
  cutDepth: "top",
  overhang: 0,
  plugDepth: 3,
  seatStyle: "plug",
  topThickness: 2,
};

export function clampLidParams(params: LidParams): LidParams {
  const seatStyle = params.seatStyle === "rimGroove" ? "rimGroove" : "plug";

  return {
    clearance: Math.max(
      0,
      finiteOr(params.clearance, DEFAULT_LID_PARAMS.clearance),
    ),
    cutDepth: params.cutDepth === "through" ? "through" : "top",
    overhang: Math.max(
      0,
      finiteOr(params.overhang, DEFAULT_LID_PARAMS.overhang),
    ),
    plugDepth: Math.max(
      MIN_THICKNESS_MM,
      finiteOr(params.plugDepth, DEFAULT_LID_PARAMS.plugDepth),
    ),
    seatStyle,
    topThickness: Math.max(
      MIN_THICKNESS_MM,
      finiteOr(params.topThickness, DEFAULT_LID_PARAMS.topThickness),
    ),
  };
}

export function validateLidParams(
  boxParams: BoxParams,
  lidParams: LidParams,
  cutout: LidCutout,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const box = clampBoxParams(boxParams);

  for (const field of NUMERIC_LID_FIELDS) {
    if (!Number.isFinite(lidParams[field])) {
      issues.push({ lidField: field, message: "Enter a number." });
    }
  }

  if (Number.isFinite(lidParams.clearance) && lidParams.clearance < 0) {
    issues.push({ lidField: "clearance", message: "Cannot be negative." });
  }

  if (Number.isFinite(lidParams.overhang) && lidParams.overhang < 0) {
    issues.push({ lidField: "overhang", message: "Cannot be negative." });
  }

  for (const field of POSITIVE_LID_FIELDS) {
    if (
      Number.isFinite(lidParams[field]) &&
      lidParams[field] < MIN_THICKNESS_MM
    ) {
      issues.push({ lidField: field, message: "Must be at least 0.2 mm." });
    }
  }

  const lid = clampLidParams(lidParams);
  const innerGuideWidth = box.interiorWidth - lid.clearance * 2;
  const innerGuideDepth = box.interiorDepth - lid.clearance * 2;

  if (innerGuideWidth <= 0 || innerGuideDepth <= 0) {
    issues.push({
      lidField: "clearance",
      message: "Clearance leaves no seat footprint.",
    });
  }

  if (cutout.enabled && cutout.error) {
    issues.push({ message: cutout.error });
  }

  if (cutout.enabled && cutout.shapes.length > 0) {
    const metrics = getLidCutoutDesignMetrics(box, lid, cutout);

    if (metrics.usableWidth <= 0 || metrics.usableDepth <= 0) {
      issues.push({
        message: "Lid cutout margin leaves no printable artwork area.",
      });
    }
  }

  return issues;
}

export function generateLidGeometry(
  boxInput: BoxParams,
  lidInput: LidParams,
  cutout?: LidCutout,
): MeshData {
  const box = clampBoxParams(boxInput);
  const lid = clampLidParams(lidInput);

  if (lid.seatStyle === "rimGroove") {
    return generateRimGrooveLidGeometry(box, lid, cutout);
  }

  return generatePlugLidGeometry(box, lid, cutout);
}

function generatePlugLidGeometry(
  box: BoxParams,
  lid: LidParams,
  cutout?: LidCutout,
): MeshData {
  const footprints = getLidFootprints(box, lid);
  const topLoop = getCorneredRectanglePoints(
    footprints.topWidth,
    footprints.topDepth,
    footprints.topCornerInset,
    box.cornerStyle,
  );
  const plugLoop = getCorneredRectanglePoints(
    footprints.innerGuideWidth,
    footprints.innerGuideDepth,
    footprints.innerGuideCornerInset,
    box.cornerStyle,
  );
  const plugBottomZ = 0;
  const plugTopZ = lid.plugDepth;
  const topZ = lid.plugDepth + lid.topThickness;
  const cutoutLoops = isCutoutReady(cutout)
    ? fitLidCutoutLoops(box, lid, cutout)
    : [];
  const shouldCutThrough = lid.cutDepth === "through";
  const triangles: Triangle[] = [];

  addHorizontalPanel(triangles, topLoop, cutoutLoops, topZ, "up");
  addVerticalWalls(
    triangles,
    loopAtZ(topLoop, plugTopZ),
    loopAtZ(topLoop, topZ),
    false,
  );
  addHorizontalPanel(triangles, topLoop, [plugLoop], plugTopZ, "down");

  if (cutoutLoops.length > 0) {
    for (const loop of cutoutLoops) {
      addVerticalWalls(
        triangles,
        loopAtZ(loop, shouldCutThrough ? plugBottomZ : plugTopZ),
        loopAtZ(loop, topZ),
        true,
      );

      if (!shouldCutThrough) {
        addHorizontalPanel(triangles, loop, [], plugTopZ, "up");
      }
    }
  }

  addVerticalWalls(
    triangles,
    loopAtZ(plugLoop, plugBottomZ),
    loopAtZ(plugLoop, plugTopZ),
    false,
  );
  addHorizontalPanel(
    triangles,
    plugLoop,
    shouldCutThrough ? cutoutLoops : [],
    plugBottomZ,
    "down",
  );

  return {
    dimensions: {
      outerDepth: footprints.topDepth,
      outerHeight: topZ,
      outerWidth: footprints.topWidth,
    },
    triangles,
  };
}

function generateRimGrooveLidGeometry(
  box: BoxParams,
  lid: LidParams,
  cutout?: LidCutout,
): MeshData {
  const footprints = getLidFootprints(box, lid);
  const topLoop = getCorneredRectanglePoints(
    footprints.topWidth,
    footprints.topDepth,
    footprints.topCornerInset,
    box.cornerStyle,
  );
  const grooveOuterLoop = getCorneredRectanglePoints(
    footprints.grooveOuterWidth,
    footprints.grooveOuterDepth,
    footprints.grooveOuterCornerInset,
    box.cornerStyle,
  );
  const innerGuideLoop = getCorneredRectanglePoints(
    footprints.innerGuideWidth,
    footprints.innerGuideDepth,
    footprints.innerGuideCornerInset,
    box.cornerStyle,
  );
  const bottomZ = 0;
  const seatTopZ = lid.plugDepth;
  const topZ = lid.plugDepth + lid.topThickness;
  const cutoutLoops = isCutoutReady(cutout)
    ? fitLidCutoutLoops(box, lid, cutout)
    : [];
  const shouldCutThrough = lid.cutDepth === "through";
  const triangles: Triangle[] = [];

  addHorizontalPanel(triangles, topLoop, cutoutLoops, topZ, "up");
  addVerticalWalls(
    triangles,
    loopAtZ(topLoop, bottomZ),
    loopAtZ(topLoop, topZ),
    false,
  );
  addHorizontalPanel(
    triangles,
    grooveOuterLoop,
    [innerGuideLoop],
    seatTopZ,
    "down",
  );

  if (cutoutLoops.length > 0) {
    for (const loop of cutoutLoops) {
      addVerticalWalls(
        triangles,
        loopAtZ(loop, shouldCutThrough ? bottomZ : seatTopZ),
        loopAtZ(loop, topZ),
        true,
      );

      if (!shouldCutThrough) {
        addHorizontalPanel(triangles, loop, [], seatTopZ, "up");
      }
    }
  }

  addVerticalWalls(
    triangles,
    loopAtZ(grooveOuterLoop, bottomZ),
    loopAtZ(grooveOuterLoop, seatTopZ),
    true,
  );
  addHorizontalPanel(triangles, topLoop, [grooveOuterLoop], bottomZ, "down");
  addVerticalWalls(
    triangles,
    loopAtZ(innerGuideLoop, bottomZ),
    loopAtZ(innerGuideLoop, seatTopZ),
    false,
  );
  addHorizontalPanel(
    triangles,
    innerGuideLoop,
    shouldCutThrough ? cutoutLoops : [],
    bottomZ,
    "down",
  );

  return {
    dimensions: {
      outerDepth: footprints.topDepth,
      outerHeight: topZ,
      outerWidth: footprints.topWidth,
    },
    triangles,
  };
}

export function getLidCutoutDesignMetrics(
  boxInput: BoxParams,
  lidInput: LidParams,
  cutout: LidCutout,
) {
  const box = clampBoxParams(boxInput);
  const lid = clampLidParams(lidInput);
  const { innerGuideCornerInset, innerGuideDepth, innerGuideWidth } =
    getLidFootprints(box, lid);
  const margin = Math.max(0, finiteOr(cutout.margin, 0));
  const usableWidth = Math.max(
    0,
    innerGuideWidth - innerGuideCornerInset * 2 - margin * 2,
  );
  const usableDepth = Math.max(
    0,
    innerGuideDepth - innerGuideCornerInset * 2 - margin * 2,
  );
  const bounds = getCutoutShapeBounds(cutout.shapes);

  if (!bounds || usableWidth === 0 || usableDepth === 0) {
    return {
      placedDepth: null,
      placedWidth: null,
      sourceDepth: null,
      sourceWidth: null,
      usableDepth,
      usableWidth,
    };
  }

  const sourceWidth = Math.max(0, bounds.maxX - bounds.minX);
  const sourceDepth = Math.max(0, bounds.maxY - bounds.minY);

  if (sourceWidth === 0 || sourceDepth === 0) {
    return {
      placedDepth: null,
      placedWidth: null,
      sourceDepth,
      sourceWidth,
      usableDepth,
      usableWidth,
    };
  }

  const artScale = Math.min(
    1,
    Math.max(MIN_CUTOUT_SCALE, finiteOr(cutout.scale, 1)),
  );
  const containScale =
    Math.min(usableWidth / sourceWidth, usableDepth / sourceDepth) * artScale;
  const shouldStretch = (cutout.fitMode ?? "contain") === "stretch";
  const scaleX = shouldStretch
    ? (usableWidth / sourceWidth) * artScale
    : containScale;
  const scaleY = shouldStretch
    ? (usableDepth / sourceDepth) * artScale
    : containScale;

  return {
    placedDepth: sourceDepth * scaleY,
    placedWidth: sourceWidth * scaleX,
    sourceDepth,
    sourceWidth,
    usableDepth,
    usableWidth,
  };
}

function getLidFootprints(box: BoxParams, lid: LidParams) {
  const dimensions = getOuterDimensions(box);
  const cornerInset = getCornerInset(box);
  const innerGuideWidth = Math.max(
    EPSILON,
    box.interiorWidth - lid.clearance * 2,
  );
  const innerGuideDepth = Math.max(
    EPSILON,
    box.interiorDepth - lid.clearance * 2,
  );
  const innerGuideCornerInset =
    box.cornerStyle === "sharp" ? 0 : Math.max(0, cornerInset - lid.clearance);

  if (lid.seatStyle === "rimGroove") {
    const outerRailThickness = box.wallThickness + lid.overhang;
    const grooveOuterWidth = Math.max(
      EPSILON,
      dimensions.outerWidth + lid.clearance * 2,
    );
    const grooveOuterDepth = Math.max(
      EPSILON,
      dimensions.outerDepth + lid.clearance * 2,
    );
    const topWidth = grooveOuterWidth + outerRailThickness * 2;
    const topDepth = grooveOuterDepth + outerRailThickness * 2;
    const grooveOuterCornerInset =
      box.cornerStyle === "sharp" ? 0 : cornerInset + lid.clearance;
    const topCornerInset =
      box.cornerStyle === "sharp"
        ? 0
        : grooveOuterCornerInset + outerRailThickness;

    return {
      grooveOuterCornerInset,
      grooveOuterDepth,
      grooveOuterWidth,
      innerGuideCornerInset,
      innerGuideDepth,
      innerGuideWidth,
      topCornerInset,
      topDepth,
      topWidth,
    };
  }

  const topWidth = dimensions.outerWidth + lid.overhang * 2;
  const topDepth = dimensions.outerDepth + lid.overhang * 2;
  const topCornerInset =
    box.cornerStyle === "sharp" ? 0 : cornerInset + lid.overhang;

  return {
    grooveOuterCornerInset: 0,
    grooveOuterDepth: 0,
    grooveOuterWidth: 0,
    innerGuideCornerInset,
    innerGuideDepth,
    innerGuideWidth,
    topCornerInset,
    topDepth,
    topWidth,
  };
}

function fitLidCutoutLoops(
  box: BoxParams,
  lid: LidParams,
  cutout: LidCutout,
): Vec2[][] {
  const bounds = getCutoutShapeBounds(cutout.shapes);

  if (!bounds) {
    return [];
  }

  const { usableDepth, usableWidth } = getLidCutoutDesignMetrics(
    box,
    lid,
    cutout,
  );

  if (usableWidth <= EPSILON || usableDepth <= EPSILON) {
    return [];
  }

  const sourceWidth = Math.max(EPSILON, bounds.maxX - bounds.minX);
  const sourceDepth = Math.max(EPSILON, bounds.maxY - bounds.minY);
  const artScale = Math.min(
    1,
    Math.max(MIN_CUTOUT_SCALE, finiteOr(cutout.scale, 1)),
  );
  const containScale =
    Math.min(usableWidth / sourceWidth, usableDepth / sourceDepth) * artScale;
  const shouldStretch = (cutout.fitMode ?? "contain") === "stretch";
  const fitScaleX = shouldStretch
    ? (usableWidth / sourceWidth) * artScale
    : containScale;
  const fitScaleY = shouldStretch
    ? (usableDepth / sourceDepth) * artScale
    : containScale;
  const sourceCenterX = (bounds.minX + bounds.maxX) / 2;
  const sourceCenterY = (bounds.minY + bounds.maxY) / 2;

  const fittedLoops = cutout.shapes
    .map((shape) =>
      ensureWinding(
        shape.contour.map(([x, y]) => [
          (x - sourceCenterX) * fitScaleX,
          -(y - sourceCenterY) * fitScaleY,
        ]),
        "ccw",
      ),
    )
    .filter(
      (loop) => loop.length >= 3 && Math.abs(getSignedArea(loop)) > 0.001,
    );

  return normalizeCutoutLoops(fittedLoops);
}

function addHorizontalPanel(
  triangles: Triangle[],
  contour: Vec2[],
  holes: Vec2[][],
  z: number,
  direction: "up" | "down",
) {
  const panelContour = ensureWinding(contour, "ccw");
  const panelHoles = holes.map((hole) => ensureWinding(hole, "cw"));
  const panelPoints = panelContour.concat(...panelHoles);
  const triangulated = ShapeUtils.triangulateShape(
    panelContour.map(toVector2),
    panelHoles.map((hole) => hole.map(toVector2)),
  );

  for (const triangle of triangulated) {
    const a = pointAtZ(panelPoints[triangle[0]], z);
    const b = pointAtZ(panelPoints[triangle[1]], z);
    const c = pointAtZ(panelPoints[triangle[2]], z);

    triangles.push(direction === "up" ? [a, b, c] : [a, c, b]);
  }
}

function addVerticalWalls(
  triangles: Triangle[],
  bottom: Vec3[],
  top: Vec3[],
  reverse: boolean,
) {
  for (let index = 0; index < bottom.length; index += 1) {
    const nextIndex = (index + 1) % bottom.length;

    if (reverse) {
      triangles.push([bottom[index], top[nextIndex], bottom[nextIndex]]);
      triangles.push([bottom[index], top[index], top[nextIndex]]);
    } else {
      triangles.push([bottom[index], bottom[nextIndex], top[nextIndex]]);
      triangles.push([bottom[index], top[nextIndex], top[index]]);
    }
  }
}

function loopAtZ(loop: Vec2[], z: number): Vec3[] {
  return loop.map((point) => pointAtZ(point, z));
}

function pointAtZ([x, y]: Vec2, z: number): Vec3 {
  return [x, y, z];
}

function normalizeCutoutLoops(loops: Vec2[][]): Vec2[][] {
  if (loops.length === 0) {
    return [];
  }

  const polygons = loops.map((loop): ClipPolygon => [closeLoop(loop)]);
  const result = polygonClipping.union(polygons as MultiPolygon);

  return result
    .map((polygon) => polygon[0])
    .filter((ring): ring is Vec2[] => Boolean(ring))
    .map((ring) => ensureWinding(removeClosingPoint(ring), "ccw"))
    .filter(
      (loop) => loop.length >= 3 && Math.abs(getSignedArea(loop)) > 0.001,
    );
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

function isCutoutReady(cutout: LidCutout | undefined): cutout is LidCutout {
  return Boolean(cutout?.enabled && !cutout.error && cutout.shapes.length > 0);
}

function ensureWinding(points: Vec2[], winding: "ccw" | "cw"): Vec2[] {
  const loop = [...points];
  const isClockwise = getSignedArea(loop) < 0;

  if (
    (winding === "cw" && !isClockwise) ||
    (winding === "ccw" && isClockwise)
  ) {
    loop.reverse();
  }

  return loop;
}

function getSignedArea(points: Vec2[]): number {
  return (
    points.reduce((area, point, index) => {
      const next = points[(index + 1) % points.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
}

function toVector2([x, y]: Vec2): Vector2 {
  return new Vector2(x, y);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
