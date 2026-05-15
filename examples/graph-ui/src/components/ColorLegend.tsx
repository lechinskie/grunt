import type { ColoringResult } from "../types";
import { SCC_PALETTE } from "../constants";

interface ColorLegendProps {
	data: ColoringResult;
	onClose: () => void;
}

export default function ColorLegend({ data, onClose }: ColorLegendProps) {
	const s = "var(--ui-scale, 1)";

	return (
		<div className="scc-legend">

			{/* Header */}
			<div style={{
				background: "#e8e8e0",
				borderBottom: "1px solid #999",
				padding: `calc(3px * ${s}) calc(8px * ${s})`,
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: `calc(8px * ${s})`,
			}}>
				<span style={{
					fontFamily: "'IM Fell English', Georgia, serif",
					fontSize: `calc(11px * ${s})`,
					fontStyle: "italic",
					color: "#222",
				}}>
					Graph Coloring
				</span>
				<button className="btn-raised danger" onClick={onClose} style={{ fontSize: `calc(9px * ${s})`, padding: `calc(1px * ${s}) calc(5px * ${s})` }}>✕</button>
			</div>

			{/* χ bound */}
			<div style={{ padding: `calc(4px * ${s}) calc(8px * ${s}) calc(2px * ${s})`, borderBottom: "1px solid #ddd" }}>
				<span style={{ fontFamily: "'Courier Prime', monospace", fontSize: `calc(11px * ${s})`, color: "#1a3a6b", fontWeight: 700 }}>
					χ ≤ {data.num_colors}
				</span>
				<span style={{ fontSize: `calc(10px * ${s})`, color: "#888", marginLeft: `calc(6px * ${s})` }}>
					color{data.num_colors !== 1 ? "s" : ""} used
				</span>
			</div>

			{/* Order */}
			<div style={{ padding: `calc(2px * ${s}) calc(8px * ${s}) calc(3px * ${s})`, borderBottom: "1px solid #eee" }}>
				{data.order.map((idx) => {
					return (
						<span style={{ fontSize: `calc(9px * ${s})`, color: "#aaa", fontStyle: "italic" }}>
							{idx + " "}
						</span>
					);

				})}
			</div>

			{/* Color class rows */}
			<div className="scc-legend-items">
				{data.color_classes.map((cls, idx) => {
					const pal = SCC_PALETTE[idx % SCC_PALETTE.length];
					return (
						<div key={idx} style={{ display: "flex", flexDirection: "column", gap: `calc(3px * ${s})` }}>
							{/* Row header */}
							<div style={{ display: "flex", alignItems: "center", gap: `calc(5px * ${s})` }}>
								<span style={{
									display: "inline-block",
									width: `calc(10px * ${s})`, height: `calc(10px * ${s})`,
									background: pal.fill,
									border: `1.5px solid ${pal.stroke}`,
									flexShrink: 0,
								}} />
								<span style={{
									fontFamily: "monospace",
									fontSize: `calc(10px * ${s})`,
									fontWeight: 700,
									color: pal.stroke,
									letterSpacing: "0.05em",
								}}>
									Color {idx + 1}
								</span>
								<span style={{ fontSize: `calc(9px * ${s})`, color: "#aaa", marginLeft: "auto" }}>
									|V| = {cls.length}
								</span>
							</div>
							{/* Vertex tags */}
							<div style={{ display: "flex", flexWrap: "wrap", gap: `calc(3px * ${s})`, paddingLeft: `calc(15px * ${s})` }}>
								{cls.map(v => (
									<span key={v} style={{
										fontFamily: "'Courier Prime', monospace",
										fontSize: `calc(10px * ${s})`,
										fontWeight: 700,
										padding: `0 calc(4px * ${s})`,
										background: pal.fill,
										border: `1px solid ${pal.stroke}`,
										color: pal.text,
									}}>{v}</span>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
