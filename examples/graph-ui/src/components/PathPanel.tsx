import type { AlgoStep } from "../types";

interface PathPanelProps {
	label: string;
	path: number[];
	cost: number;
	closed: AlgoStep[];
	onClose: () => void;
}

export default function PathPanel({ label, path, cost, closed, onClose }: PathPanelProps) {
	const s = "var(--ui-scale, 1)";
	const isAStar = closed.length > 0 && closed[0].f !== null;

	return (
		<div className="order-banner" style={{ flexWrap: "wrap", paddingBottom: `calc(6px * ${s})` }}>
			<div style={{ display: "flex", alignItems: "center", width: "100%", gap: `calc(6px * ${s})` }}>
				<span style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: `calc(11px * ${s})`, fontStyle: "italic", color: "#444", whiteSpace: "nowrap" }}>
					{label} — cost: {cost.toFixed(1)}
				</span>
				<span style={{ color: "#bbb", fontSize: `calc(11px * ${s})` }}>│</span>
				<div style={{ display: "flex", alignItems: "center", gap: `calc(4px * ${s})`, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
					{path.map((v, i) => (
						<span key={i} style={{ display: "flex", alignItems: "center", gap: `calc(2px * ${s})`, flexShrink: 0 }}>
							<span style={{ fontFamily: "'Courier Prime', monospace", fontSize: `calc(11px * ${s})`, fontWeight: 700, padding: `0 calc(5px * ${s})`, border: "1px solid #1a3a6b", color: "#1a3a6b", background: "#eff6ff" }}>{v}</span>
							{i < path.length - 1 && <span style={{ color: "#aaa", fontSize: `calc(10px * ${s})` }}>→</span>}
						</span>
					))}
				</div>
				<button onClick={onClose} className="btn-raised danger" style={{ flexShrink: 0, marginLeft: `calc(6px * ${s})`, fontSize: `calc(10px * ${s})` }}>✕ dismiss</button>
			</div>

			<div style={{ width: "100%", marginTop: `calc(4px * ${s})`, borderTop: "1px solid #d0d0c8", paddingTop: `calc(4px * ${s})`, maxHeight: `calc(120px * ${s})`, overflowY: "auto", fontSize: `calc(10px * ${s})` }}>
				<table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace" }}>
					<thead>
						<tr style={{ color: "#888", fontSize: `calc(9px * ${s})`, textAlign: "left" }}>
							<th style={{ padding: `0 calc(4px * ${s})` }}>#</th>
							<th style={{ padding: `0 calc(4px * ${s})` }}>Closed</th>
							<th style={{ padding: `0 calc(4px * ${s})` }}>g</th>
							{isAStar && <th style={{ padding: `0 calc(4px * ${s})` }}>f</th>}
						</tr>
					</thead>
					<tbody>
						{closed.map((step, i) => (
							<tr key={i} style={{ color: path.includes(step.node) ? "#1a6b3a" : "#555" }}>
								<td style={{ padding: `0 calc(4px * ${s})`, color: "#aaa" }}>{i + 1}.</td>
								<td style={{ padding: `0 calc(4px * ${s})`, fontWeight: 700 }}>{step.node}</td>
								<td style={{ padding: `0 calc(4px * ${s})` }}>{step.dist.toFixed(1)}</td>
								{isAStar && <td style={{ padding: `0 calc(4px * ${s})` }}>{step.f?.toFixed(1)}</td>}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
