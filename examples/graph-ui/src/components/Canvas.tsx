import { useState, useCallback, useRef, useEffect } from "react";
import type { RefObject } from "react";
import type { GraphSnapshot, Pos, EdgeSelection } from "../types";
import { NODE_R, ARROW, SCC_PALETTE } from "../constants";

interface CanvasProps {
  graph: GraphSnapshot;
  positions: Map<number, Pos>;
  highlighted: Set<number>;
  highlightedEdges: Set<string>;
  sccMap: Map<number, number>;
  selected: number | null;
  selectedEdge: EdgeSelection | null;
  edgeSrc: number | null;
  pan: { x: number; y: number };
  scale: number;
  weights: Map<string, number>;
  svgRef: RefObject<SVGSVGElement>;
  onNodeClick: (e: React.MouseEvent, v: number) => void;
  onEdgeClick: (src: number, dst: number) => void;
  onCanvasRightClick: (e: React.MouseEvent) => void;
  onCanvasLeftDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  onWeightEdit: (u: number, v: number, weight: number) => void;
}

function getNodeColor(v: number, sccMap: Map<number, number>, highlighted: Set<number>): string {
  if (sccMap.has(v)) return SCC_PALETTE[sccMap.get(v)! % SCC_PALETTE.length].fill;
  if (highlighted.has(v)) return "#dbeafe";
  return "#ffffff";
}

function getNodeStroke(v: number, sccMap: Map<number, number>, highlighted: Set<number>, selected: number | null, edgeSrc: number | null): string {
  if (edgeSrc === v) return "#b45309";
  if (selected === v) return "#1a3a6b";
  if (sccMap.has(v)) return SCC_PALETTE[sccMap.get(v)! % SCC_PALETTE.length].stroke;
  if (highlighted.has(v)) return "#3b82f6";
  return "#555";
}

function getNodeTextColor(v: number, sccMap: Map<number, number>, highlighted: Set<number>, selected: number | null, edgeSrc: number | null): string {
  if (edgeSrc === v) return "#92400e";
  if (selected === v) return "#1a3a6b";
  if (sccMap.has(v)) return SCC_PALETTE[sccMap.get(v)! % SCC_PALETTE.length].text;
  if (highlighted.has(v)) return "#1e40af";
  return "#111";
}

function isEdgeSelected(u: number, v: number, selectedEdge: EdgeSelection | null): boolean {
  return selectedEdge !== null && selectedEdge.src === u && selectedEdge.dst === v;
}

export default function Canvas({ graph, positions, highlighted, highlightedEdges, sccMap, selected, selectedEdge, edgeSrc, pan, scale, weights, svgRef, onNodeClick, onEdgeClick, onCanvasRightClick, onCanvasLeftDown, onWeightEdit }: CanvasProps) {
  const [editing, setEditing] = useState<{ u: number; v: number; x: number; y: number; val: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (!openedRef.current) {
        inputRef.current.select();
        openedRef.current = true;
      }
    } else {
      openedRef.current = false;
    }
  }, [editing]);

  const handleEdgeClick = useCallback((u: number, v: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgeClick(u, v);
  }, [onEdgeClick]);

  const handleDoubleClickWeight = (u: number, v: number, mx: number, my: number, currentWeight: number) => {
    setEditing({ u, v, x: mx, y: my, val: String(currentWeight) });
  };

  const commitWeight = () => {
    if (!editing) return;
    const w = parseFloat(editing.val);
    if (!isNaN(w)) {
      onWeightEdit(editing.u, editing.v, w);
    }
    setEditing(null);
  };

  const handleWeightKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitWeight();
    } else if (e.key === "Escape") {
      setEditing(null);
    }
  };

const renderEdge = (u: number, v: number, key: string) => {
    const p1 = positions.get(u), p2 = positions.get(v);
    if (!p1 || !p2) return null;
    const directed = graph.directed;
    const isLit = highlighted.has(u) && highlighted.has(v);
    const isPathEdge = highlightedEdges.has(`${u},${v}`);
    const isSelected = isEdgeSelected(u, v, selectedEdge);
    const stroke = isSelected ? "#e11d48" : isPathEdge ? "#059669" : isLit ? "#1a3a6b" : "#888";
    const sw = isSelected ? 2.5 : isPathEdge ? 2.5 : isLit ? 1.8 : 1.2;

    const hitBoxWidth = 15;

    if (u === v) {
      const pathData = `M ${p1.x - NODE_R},${p1.y} C ${p1.x - 55},${p1.y - 55} ${p1.x + 55},${p1.y - 55} ${p1.x + NODE_R},${p1.y}`;
      return (
        <g key={key} style={{ cursor: "pointer" }} onClick={(e) => handleEdgeClick(u, v, e)}>
          <path d={pathData} fill="none" stroke="transparent" strokeWidth={hitBoxWidth} />
          <path d={pathData} fill="none" stroke={stroke} strokeWidth={sw} markerEnd={directed ? "url(#arrow)" : undefined} />
        </g>
      );
    }

    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return null;
    const nx = dx / len, ny = dy / len;
    const hasRev = directed && graph.edges.some(([a, b]) => a === v && b === u);

    const offset = hasRev ? 8 : 0;
    const ox = -ny * offset, oy = nx * offset;

    const x1 = p1.x + nx * NODE_R + ox;
    const y1 = p1.y + ny * NODE_R + oy;
    const x2 = p2.x - nx * (NODE_R + (directed ? ARROW : 0)) + ox;
    const y2 = p2.y - ny * (NODE_R + (directed ? ARROW : 0)) + oy;

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const weight = weights.get(`${u},${v}`);

    return (
      <g key={key} style={{ cursor: "pointer" }} onClick={(e) => handleEdgeClick(u, v, e)}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={hitBoxWidth} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} markerEnd={directed ? "url(#arrow)" : undefined} />
        {weight !== undefined && editing?.u === u && editing?.v === v ? null : (
          <text x={mx} y={my - 8} textAnchor="middle" dominantBaseline="central" fontSize={9}
            fontFamily="monospace" fill="#555" stroke="white" strokeWidth={2.5}
            paintOrder="stroke" style={{ cursor: "pointer", userSelect: "none" }}
            onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickWeight(u, v, mx, my, weight ?? 1.0); }}>
            {weight !== undefined ? weight.toFixed(1) : "1.0"}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg id="canvas-svg" ref={svgRef} style={{ width: "100%", height: "100%", display: "block", cursor: "default" }} onMouseDown={onCanvasLeftDown} onContextMenu={onCanvasRightClick}>
      <defs>
        <pattern id="minor-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.5" fill="#ccc" />
        </pattern>
        <pattern id="major-grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <rect width="50" height="50" fill="url(#minor-dots)" />
          <circle cx="0" cy="0" r="1" fill="#bbb" />
        </pattern>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 1, 6 3.5, 0 6" fill="#888" />
        </marker>
        <marker id="arrow-blue" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
          <polygon points="0 1, 6 3.5, 0 6" fill="#1a3a6b" />
        </marker>
      </defs>

      <rect width="100%" height="100%" fill="#fff" />
      <rect width="100%" height="100%" fill="url(#major-grid)" />

      <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
        {graph.edges.map(([u, v]) => renderEdge(u, v, `e-${u}-${v}`))}
        {editing && (
          <foreignObject x={editing.x - 30} y={editing.y - 10} width={60} height={22}>
            <input
              ref={inputRef}
              type="number"
              step="any"
              value={editing.val}
              onChange={(e) => setEditing({ ...editing, val: e.target.value })}
              onKeyDown={handleWeightKeyDown}
              onBlur={commitWeight}
              style={{ width: "100%", height: "100%", padding: 0, border: "1px solid #2563eb", textAlign: "center", fontSize: 11, fontFamily: "monospace", background: "#fff" }}
            />
          </foreignObject>
        )}

        {graph.vertices.map(v => {
          const pos = positions.get(v);
          if (!pos) return null;
          const fill = getNodeColor(v, sccMap, highlighted);
          const stroke = getNodeStroke(v, sccMap, highlighted, selected, edgeSrc);
          const color = getNodeTextColor(v, sccMap, highlighted, selected, edgeSrc);
          const isEdgeSrc = edgeSrc === v;
          const isSelectedNode = selected === v;
          const sw = (isEdgeSrc || isSelectedNode) ? 2 : 1.5;

          return (
            <g key={v} transform={`translate(${pos.x},${pos.y})`} style={{ cursor: "pointer" }} onMouseDown={(e) => onNodeClick(e, v)}>
              {isEdgeSrc && <circle r={NODE_R + 6} fill="none" stroke="#b45309" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.7} />}
              {isSelectedNode && !isEdgeSrc && <circle r={NODE_R + 4} fill="none" stroke="#1a3a6b" strokeWidth={0.8} strokeOpacity={0.4} />}
              <circle r={NODE_R} fill={fill} stroke={stroke} strokeWidth={sw} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontFamily="'Courier Prime', monospace" fontWeight={isSelectedNode || isEdgeSrc ? 700 : 400} fill={color} style={{ pointerEvents: "none", userSelect: "none" }}>{v}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
