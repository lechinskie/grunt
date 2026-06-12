import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import type { GraphSnapshot, ConnectivityResult, ColoringResult, AlgoResult, Pos, Flash, EdgeSelection, GraphHistory, DetailedPathResult } from "./types";
import { CX, CY, circlePos } from "./constants";
import { TEMPLATES } from "./templates";
import Toolbar from "./components/Toolbar";
import Canvas from "./components/Canvas";
import OrderBanner from "./components/OrderBanner";
import PathPanel from "./components/PathPanel";
import SccLegend from "./components/SccLegend";
import ColorLegend from "./components/ColorLegend";
import LegendPanel from "./components/LegendPanel";
import HeuristicEditor from "./components/HeuristicEditor";
import ReportPanel from "./components/ReportPanel";

const MAX_HISTORY = 50;

const HELP_ITEMS = [
	{ key: "add-node", label: "Ctrl+Right-click", description: "Add node at cursor" },
	{ key: "add-edge", label: "Ctrl+Click nodes", description: "Click source then destination" },
	{ key: "delete", label: "Delete", description: "Delete selected node or edge" },
	{ key: "undo", label: "Ctrl+Z", description: "Undo" },
	{ key: "redo", label: "Ctrl+Y", description: "Redo" },
	{ key: "pan", label: "Left-drag canvas", description: "Pan view" },
	{ key: "move", label: "Drag node", description: "Move node" },
	{ key: "canvas-zoom", label: "Ctrl+Plus/Minus", description: "Zoom canvas" },
	{ key: "ui-zoom", label: "Ctrl+Alt+Plus/Minus", description: "Zoom UI" },
];

export default function App() {
	const [graph, setGraph] = useState<GraphSnapshot>({ vertices: [], edges: [], directed: true });
	const [positions, setPositions] = useState<Map<number, Pos>>(new Map());
	const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
	const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
	const [sccMap, setSccMap] = useState<Map<number, number>>(new Map());
	const [selectedNode, setSelectedNode] = useState<number | null>(null);
	const [selectedEdge, setSelectedEdge] = useState<EdgeSelection | null>(null);
	const [edgeSrc, setEdgeSrc] = useState<number | null>(null);
	const [result, setResult] = useState<AlgoResult>(null);
	const [flash, setFlash] = useState<Flash | null>(null);
	const [showHelp, setShowHelp] = useState(false);
	const [weights, setWeights] = useState<Map<string, number>>(new Map());

	const [uiZoom, setUiZoom] = useState(1);
	const [vInput, setVInput] = useState("");
	const [eFrom, setEFrom] = useState("");
	const [eTo, setETo] = useState("");
	const [eWeight, setEWeight] = useState("");
	const [algoV, setAlgoV] = useState("");
	const [algoTarget, setAlgoTarget] = useState("");
	const [showTemplateMenu, setShowTemplateMenu] = useState(false);
	const [showHeuristicEditor, setShowHeuristicEditor] = useState(false);

	const [showReport, setShowReport] = useState(false);
	const [astarResult, setAstarResult] = useState<DetailedPathResult | null>(null);
	const [astarParams, setAstarParams] = useState<{ source: number; target: number; heuristic: Record<number, number> } | null>(null);

	const [pan, setPan] = useState({ x: 0, y: 0 });
	const panRef = useRef(pan);
	panRef.current = pan;

	const [scale, setScale] = useState(1.0);
	const scaleRef = useRef(scale);
	scaleRef.current = scale;

	const history = useRef<GraphHistory[]>([]);
	const historyIndex = useRef(-1);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);

	const dragging = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);
	const isPanning = useRef(false);
	const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

	const svgRef = useRef<SVGSVGElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);

	const showFlash = (kind: "err" | "ok", msg: string) => {
		setFlash({ kind, msg });
		setTimeout(() => setFlash(null), 3500);
	};

	const call = async <T,>(cmd: string, args: Record<string, unknown> = {}): Promise<T | null> => {
		try { return await invoke<T>(cmd, args); }
		catch (e) { showFlash("err", String(e)); return null; }
	};

	const fetchWeights = async () => {
		const w = await call<Record<string, number>>("get_weights");
		if (w) setWeights(new Map(Object.entries(w)));
	};

	const wMap = () => Object.fromEntries(weights);

	const saveToHistory = useCallback((g: GraphSnapshot) => {
		const snapshot: GraphHistory = {
			vertices: [...g.vertices],
			edges: [...g.edges],
			directed: g.directed,
			weights: wMap(),
		};

		if (historyIndex.current < history.current.length - 1) {
			history.current = history.current.slice(0, historyIndex.current + 1);
		}

		history.current.push(snapshot);
		historyIndex.current++;

		if (history.current.length > MAX_HISTORY) {
			history.current.shift();
			historyIndex.current--;
		}

		setCanUndo(historyIndex.current > 0);
		setCanRedo(false);
	}, [weights]);

	const syncBackend = async (g: GraphSnapshot, restoreWeights?: Record<string, number>) => {
		await invoke("reset_graph");
		await invoke("set_directed", { directed: g.directed });
		for (const v of g.vertices) await invoke("add_vertex", { v });
		for (const [u, v] of g.edges) await invoke("add_edge", { u, v, weight: 1.0 });
		if (restoreWeights) {
			for (const [key, w] of Object.entries(restoreWeights)) {
				const [u, v] = key.split(",").map(Number);
				await invoke("set_weight", { u, v, weight: w });
			}
		}
	};

	const restoreFromHistory = useCallback(async (index: number) => {
		const snap = history.current[index];
		const newGraph: GraphSnapshot = {
			vertices: [...snap.vertices],
			edges: [...snap.edges],
			directed: snap.directed,
		};

		await syncBackend(newGraph, snap.weights);
		setGraph(newGraph);
		setPositions(prev => {
			const next = new Map(prev);
			newGraph.vertices.forEach((v, i) => {
				if (!next.has(v)) next.set(v, circlePos(i, newGraph.vertices.length, CX, CY, 180));
			});
			for (const k of next.keys())
				if (!newGraph.vertices.includes(k)) next.delete(k);
			return next;
		});
		setSelectedNode(null);
		setSelectedEdge(null);
		historyIndex.current = index;
		setCanUndo(historyIndex.current > 0);
		setCanRedo(historyIndex.current < history.current.length - 1);
	}, []);

	const undo = useCallback(async () => {
		if (historyIndex.current > 0) {
			await restoreFromHistory(historyIndex.current - 1);
			showFlash("ok", "undo");
		}
	}, [restoreFromHistory, showFlash]);

	const redo = useCallback(async () => {
		if (historyIndex.current < history.current.length - 1) {
			await restoreFromHistory(historyIndex.current + 1);
			showFlash("ok", "redo");
		}
	}, [restoreFromHistory, showFlash]);

	const clearResult = () => { setResult(null); setHighlighted(new Set()); setSccMap(new Map()); setHighlightedEdges(new Set()); };

	const applyGraph = useCallback((g: GraphSnapshot) => {
		setGraph(g);
		setPositions(prev => {
			const next = new Map(prev);
			g.vertices.forEach((v, i) => {
				if (!next.has(v)) next.set(v, circlePos(i, g.vertices.length, CX, CY, 180));
			});
			for (const k of next.keys())
				if (!g.vertices.includes(k)) next.delete(k);
			return next;
		});
		clearResult();
	}, []);

	const withGraph = async (cmd: string, args: Record<string, unknown> = {}, save = true) => {
		const snap = await call<GraphSnapshot>(cmd, args);
		if (snap) {
			if (save) saveToHistory(snap);
			applyGraph(snap);
			showFlash("ok", cmd.replace(/_/g, " "));
		}
	};

	const getNextId = () => graph.vertices.length === 0 ? 1 : Math.max(...graph.vertices) + 1;

	useEffect(() => {
		invoke<GraphSnapshot>("get_state").then(applyGraph);
	}, [applyGraph]);

	useEffect(() => {
		fetchWeights();
	}, [graph]);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedNode !== null) withGraph("remove_vertex", { v: selectedNode }).then(() => setSelectedNode(null));
				else if (selectedEdge !== null) withGraph("remove_edge", { u: selectedEdge.src, v: selectedEdge.dst }).then(() => setSelectedEdge(null));
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
			if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
			if ((e.ctrlKey || e.metaKey) && e.key === "h") { e.preventDefault(); setShowHelp(x => !x); }
			if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "+" || e.key === "=" || e.key === "-")) {
				e.preventDefault();
				const factor = e.key === "+" || e.key === "=" ? 1.12 : 1 / 1.12;
				setScale(s => Math.max(0.15, Math.min(8, s * factor)));
			}
			if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "+" || e.key === "=" || e.key === "-")) {
				e.preventDefault();
				const delta = e.key === "+" || e.key === "=" ? 0.1 : -0.1;
				setUiZoom(z => Math.max(0.5, Math.min(3, +(z + delta).toFixed(2))));
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [selectedNode, selectedEdge, undo, redo]);

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			if (dragging.current && canvasRef.current) {
				const rect = canvasRef.current.getBoundingClientRect();
				const { id, offsetX, offsetY } = dragging.current;
				setPositions(prev => new Map(prev).set(id, {
					x: (e.clientX - rect.left - panRef.current.x) / scaleRef.current - offsetX,
					y: (e.clientY - rect.top - panRef.current.y) / scaleRef.current - offsetY,
				}));
			} else if (isPanning.current) {
				setPan({
					x: panStart.current.px + e.clientX - panStart.current.mx,
					y: panStart.current.py + e.clientY - panStart.current.my,
				});
			}
		};
		const onMouseUp = () => { dragging.current = null; isPanning.current = false; };
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		return () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};
	}, []);

	useEffect(() => {
		const el = canvasRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			const rect = el.getBoundingClientRect();
			const isOverCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
			if (!isOverCanvas) return;
			const target = e.target as HTMLElement;
			const isOverlay = target.closest(".order-banner, .scc-legend, .legend-panel, .color-legend, .dropdown-menu");
			if (isOverlay) return;
			e.preventDefault();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
			const newScale = Math.max(0.15, Math.min(8, scaleRef.current * factor));
			setPan(prev => ({
				x: mouseX - (mouseX - prev.x) * newScale / scaleRef.current,
				y: mouseY - (mouseY - prev.y) * newScale / scaleRef.current,
			}));
			setScale(newScale);
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, []);

	const runAlgo = async (cmd: string, label: string, parseVertex = true) => {
		const v = parseInt(algoV);
		if (parseVertex && isNaN(v)) { showFlash("err", "specify vertex"); return; }
		const data = await call<number[] | ConnectivityResult>(cmd, parseVertex ? { start: v } : { v });
		if (!data) return;
		if (Array.isArray(data)) {
			setResult({ kind: "traversal", label, order: data });
			setHighlighted(new Set(data));
		} else {
			setResult({ kind: "connectivity", data });
			const map = new Map<number, number>();
			data.components.forEach((comp, idx) => comp.forEach(v => map.set(v, idx)));
			setSccMap(map);
			setHighlighted(new Set());
		}
	};

	const handleColoring = async () => {
		const data = await call<ColoringResult>("run_coloring");
		if (!data) return;
		setResult({ kind: "coloring", data });
		const map = new Map<number, number>();
		data.color_classes.forEach((cls, idx) => cls.forEach(v => map.set(v, idx)));
		setSccMap(map);
		setHighlighted(new Set());
		showFlash("ok", `coloring — χ ≤ ${data.num_colors}`);
	};

	const handleDijkstra = async () => {
		const s = parseInt(algoV);
		if (isNaN(s)) { showFlash("err", "specify source vertex"); return; }
		const data = await call<Record<number, number>>("run_dijkstra", { source: s });
		if (!data) return;
		const entries = Object.entries(data).map(([v, d]) => `${v}:${d.toFixed(1)}`);
		setHighlighted(new Set(Object.keys(data).map(Number)));
		setHighlightedEdges(new Set());
		setResult(null);
		showFlash("ok", `Dijkstra from ${s} — ${entries.join(", ")}`);
	};

	const handleDijkstraPath = async () => {
		const s = parseInt(algoV), t = parseInt(algoTarget);
		if (isNaN(s) || isNaN(t)) { showFlash("err", "specify source & target"); return; }
		const data = await call<DetailedPathResult | null>("run_dijkstra_path", { source: s, target: t });
		if (!data) { showFlash("err", "no path found"); return; }
		const { path, cost, closed } = data;
		setResult({ kind: "path", label: `Dijkstra ${s}→${t}`, path, cost, closed });
		setHighlighted(new Set(path));
		const edges = new Set<string>();
		for (let i = 0; i < path.length - 1; i++) edges.add(`${path[i]},${path[i + 1]}`);
		setHighlightedEdges(edges);
	};

	const handleAStar = () => {
		const s = parseInt(algoV), t = parseInt(algoTarget);
		if (isNaN(s) || isNaN(t)) { showFlash("err", "specify source & target"); return; }
		setShowHeuristicEditor(true);
	};

	const showPathOnCanvas = (data: DetailedPathResult, label: string) => {
		const { path, cost, closed } = data;
		setResult({ kind: "path", label, path, cost, closed });
		setHighlighted(new Set(path));
		const edges = new Set<string>();
		for (let i = 0; i < path.length - 1; i++) edges.add(`${path[i]},${path[i + 1]}`);
		setHighlightedEdges(edges);
	};

	const handleRunAStar = async (heuristic: Record<number, number>) => {
		setShowHeuristicEditor(false);
		const s = parseInt(algoV), t = parseInt(algoTarget);
		const data = await call<DetailedPathResult | null>("run_a_star", { source: s, target: t, heuristic });
		if (!data) { showFlash("err", "no path found"); return; }

			showPathOnCanvas(data, `A* ${s}→${t}`);
			setAstarResult(data);
			setAstarParams({ source: s, target: t, heuristic });
		};
			const handleAddVertex = async () => {
			const v = parseInt(vInput);
			if (isNaN(v)) { showFlash("err", "invalid vertex id"); return; }
			await withGraph("add_vertex", { v });
			setVInput("");
		};

	const handleRemoveVertex = async () => {
		const v = parseInt(vInput);
		if (isNaN(v)) { showFlash("err", "invalid vertex id"); return; }
		await withGraph("remove_vertex", { v });
		setVInput("");
	};

	const handleAddEdge = async () => {
		const u = parseInt(eFrom), v = parseInt(eTo);
		if (isNaN(u) || isNaN(v)) { showFlash("err", "invalid endpoint(s)"); return; }
		const weight = parseFloat(eWeight) || 1.0;
		await withGraph("add_edge", { u, v, weight });
	};

	const handleRemoveEdge = async () => {
		const u = parseInt(eFrom), v = parseInt(eTo);
		if (isNaN(u) || isNaN(v)) { showFlash("err", "invalid endpoint(s)"); return; }
		await withGraph("remove_edge", { u, v });
	};

	const handleSetDirected = async (d: boolean) => {
		const snap = await call<GraphSnapshot>("set_directed", { directed: d });
		if (snap) { saveToHistory(snap); applyGraph(snap); }
	};

	const handleReset = async () => {
		const snap = await call<GraphSnapshot>("reset_graph");
		if (snap) {
			history.current = [];
			historyIndex.current = -1;
			saveToHistory(snap);
			applyGraph(snap);
			setPositions(new Map());
			setEdgeSrc(null);
			setCanUndo(false);
			setCanRedo(false);
		}
	};

	const loadTemplate = async (key: string) => {
		setShowTemplateMenu(false);
		const t = TEMPLATES[key];
		if (!t) return;
		try {
			await invoke("set_directed", { directed: t.directed });
			await invoke("reset_graph");
			for (const v of t.vertices) await invoke("add_vertex", { v });
			for (const [u, v] of t.edges) {
				const weight = t.weights?.[`${u},${v}`] ?? 1.0;
				await invoke("add_edge", { u, v, weight });
			}
			const snap = await invoke<GraphSnapshot>("get_state");

			history.current = [];
			historyIndex.current = -1;
			saveToHistory(snap);

			setGraph(snap);
			const posMap = new Map<number, Pos>();
			t.vertices.forEach((v, i) => posMap.set(v, t.positions[i]));
			setPositions(posMap);
			clearResult(); setSelectedNode(null); setEdgeSrc(null); setPan({ x: 0, y: 0 });
			showFlash("ok", `loaded ${t.label}`);
		} catch (e) { showFlash("err", String(e)); }
	};

	const handleLoadJson = (file: File) => {
		const reader = new FileReader();
		reader.onload = async (ev) => {
			try {
				const data = JSON.parse(ev.target?.result as string);
				if (!data.nodes || !data.edges) {
					showFlash("err", "invalid JSON: missing nodes or edges");
					return;
				}
				const nameToId: Record<string, number> = {};
				for (const entry of data.nodes) {
					const name = Object.keys(entry)[0];
					nameToId[name] = entry[name];
				}
				const ids = Object.values(nameToId).sort((a, b) => a - b) as number[];
				const edgeSet = new Set<string>();
				const weights: Record<string, number> = {};
				for (const [key, dist] of Object.entries(data.edges)) {
					const [srcName, dstName] = key.split(":");
					if (!srcName || !dstName) continue;
					const u = nameToId[srcName];
					const v = nameToId[dstName];
					if (u === undefined || v === undefined || u === v) continue;
					const normKey = u < v ? `${u},${v}` : `${v},${u}`;
					edgeSet.add(normKey);
					if (!weights[normKey]) weights[normKey] = dist as number;
				}
				const edges: [number, number][] = [...edgeSet].map(k => k.split(",").map(Number) as [number, number]);
				await invoke("set_directed", { directed: false });
				await invoke("reset_graph");
				for (const v of ids) await invoke("add_vertex", { v });
				for (const [u, v] of edges) {
					const w = weights[`${u},${v}`] ?? 1.0;
					await invoke("add_edge", { u, v, weight: w });
				}
				const snap = await invoke<GraphSnapshot>("get_state");
				history.current = [];
				historyIndex.current = -1;
				saveToHistory(snap);
				setGraph(snap);
				const posMap = new Map<number, Pos>();
				if (Array.isArray(data.positions) && data.positions.length >= ids.length) {
					ids.forEach((v, i) => posMap.set(v, { x: data.positions[i].x, y: data.positions[i].y }));
				} else {
					ids.forEach((v, i) => posMap.set(v, circlePos(i, ids.length, CX, CY, 180)));
				}
				setPositions(posMap);
				clearResult(); setSelectedNode(null); setEdgeSrc(null); setPan({ x: 0, y: 0 });
				showFlash("ok", `loaded ${ids.length} nodes, ${edges.length} edges`);
			} catch (e) { showFlash("err", String(e)); }
		};
		reader.readAsText(file);
	};

	const handleNodeClick = (e: React.MouseEvent, v: number) => {
		e.stopPropagation();

		if (e.ctrlKey || e.metaKey) {
			if (edgeSrc === null) {
				setEdgeSrc(v);
				setEFrom(String(v));
				showFlash("ok", `edge source: ${v}`);
			} else if (edgeSrc === v) {
				setEdgeSrc(null);
				showFlash("err", "cancelled");
			} else {
				const u = edgeSrc;
				setEdgeSrc(null);
				setEFrom(String(u));
				setETo(String(v));
				const w = parseFloat(eWeight) || 1.0;
				invoke<GraphSnapshot>("add_edge", { u, v, weight: w })
					.then(snap => { if (snap) { saveToHistory(snap); applyGraph(snap); showFlash("ok", `edge (${u}, ${v})`); } })
					.catch(err => showFlash("err", String(err)));
			}
			return;
		}

		setEdgeSrc(null);
		setSelectedNode(v);
		setSelectedEdge(null);
		setAlgoV(String(v));
		setEFrom(String(v));

		const nodePos = positions.get(v);
		if (nodePos && canvasRef.current) {
			const rect = canvasRef.current.getBoundingClientRect();
			const mouseX = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
			const mouseY = (e.clientY - rect.top - panRef.current.y) / scaleRef.current;
			dragging.current = { id: v, offsetX: mouseX - nodePos.x, offsetY: mouseY - nodePos.y };
		} else {
			dragging.current = { id: v, offsetX: 0, offsetY: 0 };
		}
	};

	const handleEdgeClick = (src: number, dst: number) => {
		setSelectedEdge({ src, dst });
		setSelectedNode(null);
		setEFrom(String(src));
		setETo(String(dst));
	};

	const handleCanvasRightClick = (e: React.MouseEvent) => {
		e.preventDefault();
		if ((e.ctrlKey || e.metaKey) && canvasRef.current) {
			const rect = canvasRef.current.getBoundingClientRect();
			const x = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
			const y = (e.clientY - rect.top - panRef.current.y) / scaleRef.current;
			const nextId = getNextId();
			invoke<GraphSnapshot>("add_vertex", { v: nextId })
				.then(snap => {
					if (snap) {
						saveToHistory(snap);
						setGraph(snap);
						setPositions(prev => {
							const next = new Map(prev);
							snap.vertices.forEach((v, i) => {
								if (!next.has(v)) next.set(v, v === nextId ? { x, y } : circlePos(i, snap.vertices.length, CX, CY, 180));
							});
							for (const k of next.keys())
								if (!snap.vertices.includes(k)) next.delete(k);
							return next;
						});
						showFlash("ok", `node ${nextId}`);
					}
				})
				.catch(err => showFlash("err", String(err)));
		}
	};

	const handleWeightEdit = async (u: number, v: number, weight: number) => {
		await invoke("set_weight", { u, v, weight });
		fetchWeights();
	};

	const handleCanvasLeftDown = (e: React.MouseEvent<SVGSVGElement>) => {
		if (e.button !== 0) return;
		isPanning.current = true;
		panStart.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
		setSelectedNode(null);
		setSelectedEdge(null);
	};

	const showBanner = result?.kind === "traversal" || result?.kind === "closure" || result?.kind === "path";
	const orderLabel = result?.kind === "traversal" ? result.label : result?.kind === "closure" ? result.label : result?.kind === "path" ? result.label : "";
	const orderItems = result?.kind === "traversal" ? result.order.map((v, i) => ({ v, idx: i + 1 })) : result?.kind === "closure" ? result.vertices.map(v => ({ v })) : result?.kind === "path" ? result.path.map((v, i) => ({ v, idx: i + 1 })) : [];
	const connData = result?.kind === "connectivity" ? result.data : null;
	const colorData = result?.kind === "coloring" ? result.data : null;
	const pathData = result?.kind === "path" ? result : null;

	return (
		<div
			className="app-root"
			style={{
				"--ui-scale": uiZoom,
				display: "flex",
				flexDirection: "column",
				height: "100dvh",
				width: "100%",
				overflow: "hidden",
				background: "#fafaf7",
			} as React.CSSProperties}
		>
			<Toolbar
				graph={graph} flash={flash} hasResult={result !== null}
				vInput={vInput} setVInput={setVInput}
				eFrom={eFrom} setEFrom={setEFrom}
				eTo={eTo} setETo={setETo}
				eWeight={eWeight} setEWeight={setEWeight}
				algoV={algoV} setAlgoV={setAlgoV}
				algoTarget={algoTarget} setAlgoTarget={setAlgoTarget}
				showTemplateMenu={showTemplateMenu}
				onToggleTemplateMenu={() => setShowTemplateMenu(x => !x)}
				onAddVertex={handleAddVertex} onRemoveVertex={handleRemoveVertex}
				onAddEdge={handleAddEdge} onRemoveEdge={handleRemoveEdge}
				onSetDirected={handleSetDirected} onReset={handleReset}
				onBfs={() => runAlgo("run_bfs", `BFS from ${algoV}`)}
				onDfs={() => runAlgo("run_dfs", `DFS from ${algoV}`)}
				onClosureDirect={() => runAlgo("get_transitive_direct", `TC+(${algoV})`, false)}
				onClosureIndirect={() => runAlgo("get_transitive_indirect", `TC-(${algoV})`, false)}
				onConnectivity={() => runAlgo("check_connectivity", "Connectivity")}
				onColor={handleColoring}
				onDijkstra={handleDijkstra}
				onDijkstraPath={handleDijkstraPath}
				onAStar={handleAStar}
				hasAstarResult={astarResult !== null}
				onReport={() => setShowReport(true)}
				onClearResult={clearResult}
				onLoadTemplate={loadTemplate}
				onLoadJson={handleLoadJson}
				canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
				onToggleHelp={() => setShowHelp(x => !x)}
				selected={selectedNode}
				selectedEdge={selectedEdge}
				uiZoom={uiZoom}
				setUiZoom={setUiZoom}
			/>

			<div className="canvas-area" ref={canvasRef}>
				{showBanner && pathData ? (
					<PathPanel
						label={pathData.label}
						path={pathData.path}
						cost={pathData.cost}
						closed={pathData.closed}
						onClose={clearResult}
					/>
				) : showBanner ? (
					<OrderBanner
						label={orderLabel}
						items={orderItems}
						onClose={clearResult}
					/>
				) : null}

				{edgeSrc !== null && (
					<div style={{ position: "absolute", top: showBanner ? 33 : 0, left: 0, right: 0, zIndex: 9, background: "#fffbeb", borderBottom: "1px solid #d97706", padding: "2px 10px", fontSize: 10, color: "#92400e", fontFamily: "monospace" }}>
						Edge source: <strong>{edgeSrc}</strong> — Ctrl+click destination to add edge
					</div>
				)}

				<Canvas
					graph={graph}
					positions={positions}
					highlighted={highlighted}
					highlightedEdges={highlightedEdges}
					sccMap={sccMap}
					selected={selectedNode}
					selectedEdge={selectedEdge}
					edgeSrc={edgeSrc}
					pan={pan}
					scale={scale}
					weights={weights}
					svgRef={svgRef}
					onNodeClick={handleNodeClick}
					onEdgeClick={handleEdgeClick}
					onCanvasRightClick={handleCanvasRightClick}
					onCanvasLeftDown={handleCanvasLeftDown}
					onWeightEdit={handleWeightEdit}
				/>

				{graph.vertices.length === 0 && (
					<div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontFamily: "'IM Fell English', Georgia, serif", fontSize: 12, fontStyle: "italic", color: "#999", background: "rgba(255,255,255,0.85)", border: "1px solid #ddd", padding: "3px 14px" }}>
						Add vertices using the toolbar, or load a template
					</div>
				)}

				{connData && <SccLegend data={connData} directed={graph.directed} onClose={clearResult} />}
				{colorData && <ColorLegend data={colorData} onClose={clearResult} />}
				{showHelp && <LegendPanel title="Shortcuts" items={HELP_ITEMS} onClose={() => setShowHelp(false)} />}
			</div>

			<HeuristicEditor
				open={showHeuristicEditor}
				vertices={graph.vertices}
				target={parseInt(algoTarget) || 0}
				onRunAStar={handleRunAStar}
				onClose={() => setShowHeuristicEditor(false)}
			/>
		{showReport && astarResult && astarParams && (
			<ReportPanel
				source={astarParams.source}
				target={astarParams.target}
				heuristic={astarParams.heuristic}
				normalResult={astarResult}
				onClose={() => setShowReport(false)}
				onShowResult={showPathOnCanvas}
				fetchWeights={fetchWeights}
			/>
		)}
		</div>
	);
}
