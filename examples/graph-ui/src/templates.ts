import type { Pos } from "./types";
import { circlePos, CX, CY } from "./constants";

export interface TemplateData {
  label: string;
  vertices: number[];
  edges: [number, number][];
  directed: boolean;
  positions: Pos[];
  weights?: Record<string, number>;
}

export const TEMPLATES: Record<string, TemplateData> = {
  triangle: {
    label: "Triangle  C₃", directed: true,
    vertices: [0,1,2], edges: [[0,1],[1,2],[2,0]],
    positions: [0,1,2].map(i => circlePos(i, 3, CX, CY, 190)),
  },
  square: {
    label: "Square  C₄", directed: true,
    vertices: [0,1,2,3], edges: [[0,1],[1,2],[2,3],[3,0]],
    positions: [0,1,2,3].map(i => circlePos(i, 4, CX, CY, 200)),
  },
  k4: {
    label: "Complete  K₄", directed: false,
    vertices: [0,1,2,3], edges: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
    positions: [0,1,2,3].map(i => circlePos(i, 4, CX, CY, 200)),
  },
  k5: {
    label: "Complete  K₅", directed: false,
    vertices: [0,1,2,3,4],
    edges: [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]],
    positions: [0,1,2,3,4].map(i => circlePos(i, 5, CX, CY, 210)),
  },
  star: {
    label: "Star  K₁,₄", directed: false,
    vertices: [0,1,2,3,4], edges: [[0,1],[0,2],[0,3],[0,4]],
    positions: [{ x: CX, y: CY }, ...[0,1,2,3].map(i => circlePos(i, 4, CX, CY, 200))],
  },
  path: {
    label: "Path  P₅", directed: true,
    vertices: [0,1,2,3,4], edges: [[0,1],[1,2],[2,3],[3,4]],
    positions: [0,1,2,3,4].map(i => ({ x: 80 + i * 160, y: CY })),
  },
  bintree: {
    label: "Binary Tree  T₇", directed: true,
    vertices: [0,1,2,3,4,5,6],
    edges: [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6]],
    positions: [
      { x: CX,       y: 100 },
      { x: CX - 170, y: 240 }, { x: CX + 170, y: 240 },
      { x: CX - 260, y: 400 }, { x: CX - 80,  y: 400 },
      { x: CX + 80,  y: 400 }, { x: CX + 260, y: 400 },
    ],
  },
  scc: {
    label: "SCC Demo  3-comp", directed: true,
    vertices: [0,1,2,3,4,5],
    edges: [[0,1],[1,2],[2,0],[2,3],[3,4],[4,5],[5,3]],
    positions: [
      { x: 150, y: CY }, { x: 290, y: CY - 110 }, { x: 290, y: CY + 110 },
      { x: 460, y: CY }, { x: 590, y: CY - 110 }, { x: 590, y: CY + 110 },
    ],
  },
  petersen: {
    label: "Petersen  G(5,2)", directed: false,
    vertices: [0,1,2,3,4,5,6,7,8,9],
    edges: [
      [0,1],[1,2],[2,3],[3,4],[4,0],
      [5,7],[7,9],[9,6],[6,8],[8,5],
      [0,5],[1,6],[2,7],[3,8],[4,9],
    ],
    positions: [
      ...[0,1,2,3,4].map(i => circlePos(i, 5, CX, CY, 210)),
      ...[0,1,2,3,4].map(i => circlePos(i, 5, CX, CY, 100)),
    ],
  },
  wheel: {
    label: "Wheel  W₆", directed: false,
    vertices: [0,1,2,3,4,5,6],
    edges: [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,2],[2,3],[3,4],[4,5],[5,6],[6,1]],
    positions: [
      { x: CX, y: CY },
      ...[0,1,2,3,4,5].map(i => circlePos(i, 6, CX, CY, 210)),
    ],
  },
};
