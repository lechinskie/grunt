import { useState, useEffect } from "react";

interface HeuristicEditorProps {
	open: boolean;
	vertices: number[];
	target: number;
	onRunAStar: (heuristic: Record<number, number>) => void;
	onClose: () => void;
}

interface DistHData {
	nodes: Record<string, number>[];
	h: Record<string, Record<string, number>>;
}

function getCityName(v: number, data: DistHData): string | null {
	for (const entry of data.nodes) {
		const name = Object.keys(entry)[0];
		if (entry[name] === v) return name;
	}
	return null;
}

function buildHeuristicMap(
	target: number,
	data: DistHData,
): Record<number, number> {
	const targetName = getCityName(target, data);
	if (!targetName) return {};

	const hTarget = data.h[targetName];
	if (!hTarget) return {};

	const map: Record<number, number> = {};
	for (const entry of data.nodes) {
		const name = Object.keys(entry)[0];
		const id = entry[name];
		if (hTarget[name] !== undefined) {
			map[id] = hTarget[name];
		}
	}
	return map;
}

export default function HeuristicEditor({
	open,
	vertices,
	target,
	onRunAStar,
	onClose,
}: HeuristicEditorProps) {
	const [jsonText, setJsonText] = useState("");
	const [parsed, setParsed] = useState<DistHData | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!open) return;
		fetch("/dist_h.json")
			.then((r) => r.text())
			.then((text) => {
				setJsonText(text);
				try {
					setParsed(JSON.parse(text));
				} catch {
					setError("Failed to parse dist_h.json");
				}
			})
			.catch(() => {
				setJsonText(JSON.stringify({ nodes: vertices.map((v) => ({ [String(v)]: v })), h: {} }, null, 2));
			});
	}, [open, vertices]);

	const handleRun = () => {
		if (!parsed) {
			setError("Parse the JSON first");
			return;
		}
		if (!vertices.includes(target)) {
			setError(`Target vertex ${target} not in graph`);
			return;
		}
		const h = buildHeuristicMap(target, parsed);
		if (Object.keys(h).length === 0) {
			setError(`No heuristic data found for target ${target}`);
			return;
		}
		onRunAStar(h);
	};

	if (!open) return null;

	return (
		<>
			<div
				style={{
					position: "fixed",
					inset: 0,
					background: "rgba(0,0,0,0.3)",
					zIndex: 9998,
				}}
				onClick={onClose}
			/>
			<div
				style={{
					position: "fixed",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					zIndex: 9999,
					background: "#f5f5f0",
					border: "2px solid #666",
					boxShadow: "4px 4px 0 #aaa",
					padding: 16,
					minWidth: 500,
					maxWidth: 700,
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
					fontFamily: "monospace",
					fontSize: 12,
				}}
			>
				<div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
					Heuristic Editor (dist_h.json format)
				</div>

				<div style={{ marginBottom: 8, fontSize: 11, color: "#555" }}>
					Target: <strong>{target}</strong> — edit heuristic values below, then Apply
				</div>

				<textarea
					value={jsonText}
					onChange={(e) => setJsonText(e.target.value)}
					style={{
						flex: 1,
						minHeight: 300,
						border: "1px solid #999",
						padding: 6,
						fontSize: 11,
						fontFamily: "monospace",
						resize: "vertical",
						background: "#fff",
					}}
				/>

				{error && (
					<div style={{ color: "#e11d48", marginTop: 6, fontWeight: 700 }}>{error}</div>
				)}

				<div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
					<button
						onClick={onClose}
						style={{ padding: "4px 14px", border: "1px solid #999", background: "#e8e8e0", cursor: "pointer" }}
					>
						Cancel
					</button>
					<button
						onClick={handleRun}
						style={{
							padding: "4px 14px",
							border: "1px solid #2563eb",
							background: "#2563eb",
							color: "#fff",
							cursor: "pointer",
							fontWeight: 700,
						}}
					>
						Apply &amp; Run A*
					</button>
				</div>
			</div>
		</>
	);
}
