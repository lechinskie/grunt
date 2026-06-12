import { useRef, useState, useEffect } from "react";
import type { GraphSnapshot, Flash, EdgeSelection } from "../types";
import { TEMPLATES } from "../templates";

interface ToolbarProps {
	graph: GraphSnapshot;
	flash: Flash | null;
	hasResult: boolean;
	vInput: string; setVInput: (v: string) => void;
	eFrom: string; setEFrom: (v: string) => void;
	eTo: string; setETo: (v: string) => void;
	eWeight: string; setEWeight: (v: string) => void;
	algoV: string; setAlgoV: (v: string) => void;
	algoTarget: string; setAlgoTarget: (v: string) => void;
	showTemplateMenu: boolean;
	onToggleTemplateMenu: () => void;
	onAddVertex: () => void; onRemoveVertex: () => void;
	onAddEdge: () => void; onRemoveEdge: () => void;
	onSetDirected: (d: boolean) => void;
	onReset: () => void;
	onBfs: () => void; onDfs: () => void;
	onClosureDirect: () => void; onClosureIndirect: () => void;
	onConnectivity: () => void; onClearResult: () => void;
	onColor: () => void;
	onDijkstra: () => void;
	onDijkstraPath: () => void;
	onAStar: () => void;
	onLoadTemplate: (key: string) => void;
	onLoadJson: (file: File) => void;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onToggleHelp: () => void;
	selected: number | null;
	selectedEdge: EdgeSelection | null;
	uiZoom: number;
	setUiZoom: React.Dispatch<React.SetStateAction<number>>;
	hasAstarResult: boolean;
	onReport: () => void;
}

function Sep() { return <div className="tb-sep" />; }
function Lbl({ c }: { c: string }) { return <span className="tb-label">{c}</span>; }

function Btn({ children, onClick, cls = "", title, disabled }: { children: React.ReactNode; onClick?: () => void; cls?: string; title?: string; disabled?: boolean; }) {
	return <button className={`btn-raised ${cls}`} onClick={onClick} title={title} disabled={disabled}>{children}</button>;
}

function Field({ value, onChange, onEnter, placeholder }: { value: string; onChange: (v: string) => void; onEnter?: () => void; placeholder?: string; }) {
	return <input type="number" className="field-sunken" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === "Enter" && onEnter?.()} />;
}

function TemplateDropdown({ anchorRef, onClose, onSelect }: { anchorRef: React.RefObject<HTMLButtonElement>; onClose: () => void; onSelect: (key: string) => void; }) {
	const [pos, setPos] = useState({ top: 0, left: 0 });
	const s = "var(--ui-scale, 1)";
	useEffect(() => { if (anchorRef.current) { const r = anchorRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 1, left: r.left }); } }, [anchorRef]); return (
		<>
			<div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose} />
			<div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, background: "#e8e8e0", border: "1px solid #999", boxShadow: "2px 2px 0 #aaa", minWidth: `calc(190px * ${s})` }}>
				{Object.entries(TEMPLATES).map(([key, t]) => <button key={key} className="dropdown-item" onClick={() => { onSelect(key); onClose(); }}>{t.label}</button>)}
			</div>
		</>
	);
}

export default function Toolbar({ graph, flash, hasResult, vInput, setVInput, eFrom, setEFrom, eTo, setETo, eWeight, setEWeight, algoV, setAlgoV, algoTarget, setAlgoTarget, showTemplateMenu, onToggleTemplateMenu, onAddVertex, onRemoveVertex, onAddEdge, onRemoveEdge, onSetDirected, onReset, onBfs, onDfs, onClosureDirect, onClosureIndirect, onConnectivity, onClearResult, onColor, onDijkstra, onDijkstraPath, onAStar, onLoadTemplate, onLoadJson, canUndo, canRedo, onUndo, onRedo, onToggleHelp, selected, selectedEdge, uiZoom, setUiZoom, hasAstarResult, onReport }: ToolbarProps) {
	const templateBtnRef = useRef<HTMLButtonElement>(null);
	const jsonInputRef = useRef<HTMLInputElement>(null);
	const selectionInfo = selected !== null ? `Node ${selected}` : selectedEdge !== null ? `Edge (${selectedEdge.src},${selectedEdge.dst})` : null;
	const s = "var(--ui-scale, 1)";

	return (
		<div className="toolbar">
			<div className="tb-group" style={{ paddingRight: `calc(6px * ${s})` }}>
				<span style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: `calc(13px * ${s})`, fontWeight: 700, color: "#1a1a1a" }}>Graph Explorer</span>
				<span style={{ fontSize: `calc(9px * ${s})`, color: "#888", marginLeft: `calc(4px * ${s})` }}>|V|={graph.vertices.length} |E|={graph.edges.length}</span>
			</div>

			<Sep />
			<div className="tb-group"><Lbl c="Edit" /><Btn onClick={onUndo} disabled={!canUndo} title="Ctrl+Z">Undo</Btn><Btn onClick={onRedo} disabled={!canRedo} title="Ctrl+Y">Redo</Btn></div>
			<Sep />
			<div className="tb-group"><Lbl c="Type" /><div className="toggle-pair"><button className={graph.directed ? "on" : ""} onClick={() => onSetDirected(true)}>Directed</button><button className={!graph.directed ? "on" : ""} onClick={() => onSetDirected(false)}>Undirected</button></div></div>
			<Sep />
			<div className="tb-group"><Lbl c="Vertex" /><Field value={vInput} onChange={setVInput} onEnter={onAddVertex} placeholder="id" /><Btn onClick={onAddVertex} cls="primary" title="Add vertex">+</Btn><Btn onClick={onRemoveVertex} cls="danger" title="Remove vertex">−</Btn></div>
			<Sep />
			<div className="tb-group"><Lbl c="Edge" /><Field value={eFrom} onChange={setEFrom} placeholder="src" /><span style={{ fontFamily: "monospace", fontSize: `calc(11px * ${s})`, color: "#555" }}>{graph.directed ? "→" : "—"}</span><Field value={eTo} onChange={setETo} placeholder="dst" /><Field value={eWeight} onChange={setEWeight} placeholder="w" /><Btn onClick={onAddEdge} cls="primary" title="Add edge">+</Btn><Btn onClick={onRemoveEdge} cls="danger" title="Remove edge">−</Btn></div>
			<Sep />
			<div className="tb-group"><Lbl c="Template" /><button ref={templateBtnRef} className="btn-raised" onClick={onToggleTemplateMenu}>Load ▾</button>{showTemplateMenu && <TemplateDropdown anchorRef={templateBtnRef} onClose={onToggleTemplateMenu} onSelect={onLoadTemplate} />}<button className="btn-raised" onClick={() => jsonInputRef.current?.click()} title="Load JSON file">JSON</button><input ref={jsonInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { onLoadJson(f); e.target.value = ""; } }} /></div>
			<Sep />
			<div className="tb-group"><Lbl c="Algorithm" /><Field value={algoV} onChange={setAlgoV} placeholder="src" /><Field value={algoTarget} onChange={setAlgoTarget} placeholder="tgt" /><Btn onClick={onBfs} title="Breadth-First Search">BFS</Btn><Btn onClick={onDfs} title="Depth-First Search">DFS</Btn><Btn onClick={onClosureDirect} title="Reachable from">TC+</Btn><Btn onClick={onClosureIndirect} title="Reaches">TC-</Btn><Btn onClick={onDijkstra} cls="primary" title="Dijkstra shortest distances">Dij</Btn><Btn onClick={onDijkstraPath} cls="primary" title="Dijkstra shortest path">→Dij</Btn><Btn onClick={onAStar} cls="primary" title="A* search">A*</Btn>{hasAstarResult && <Btn onClick={onReport} cls="primary" title="Generate congestion comparison report">Report</Btn>}<Btn onClick={onConnectivity} cls="primary" title="Connected components">Analyse</Btn><Btn onClick={onColor} cls="primary" title="DSatur graph coloring">Color</Btn>{hasResult && <Btn onClick={onClearResult} cls="danger">✕</Btn>}</div>

			<span style={{ flex: 1 }} />


			<div className="tb-group">
				<Lbl c="Zoom" />

				<Btn
					onClick={() => setUiZoom((z: number) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
					title="Zoom out (Ctrl+Alt+-)"
				>
					−
				</Btn>

				<span style={{ fontSize: `calc(11px * ${s})`, width: `calc(36px * ${s})`, textAlign: "center" }}>
					{(uiZoom * 100).toFixed(0)}%
				</span>

				<Btn
					onClick={() => setUiZoom((z: number) => Math.min(3, +(z + 0.1).toFixed(2)))}
					title="Zoom in (Ctrl+Alt++)"
				>
					+
				</Btn>
			</div>

			{selectionInfo && <div className="tb-group"><span style={{ fontSize: `calc(10px * ${s})`, color: "#1a3a6b", fontWeight: 700, background: "#e8f0f8", padding: `calc(2px * ${s}) calc(6px * ${s})`, borderRadius: 2 }}>{selectionInfo}</span><span style={{ fontSize: `calc(9px * ${s})`, color: "#999" }}>Del</span></div>}
			{flash && <span className={`flash ${flash.kind}`}>{flash.kind === "ok" ? "✓" : "✕"} {flash.msg}</span>}
			<Sep />
			<div className="tb-group"><Btn onClick={onToggleHelp} title="Show shortcuts">? Help</Btn><Btn onClick={onReset} cls="danger" title="Clear graph">Clear</Btn></div>
		</div>
	);
}