import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DetailedPathResult } from "../types";

interface ReportPanelProps {
    source: number;
    target: number;
    heuristic: Record<number, number>;
    normalResult: DetailedPathResult;
    onClose: () => void;
    onShowResult: (result: DetailedPathResult, label: string) => void;
    fetchWeights: () => Promise<void>;
}

interface CongestionEdge {
    u: number;
    v: number;
    originalWeight: number;
    multiplier: number;
    enabled: boolean;
}

function edgesFromPath(path: number[]): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < path.length - 1; i++) out.push([path[i], path[i + 1]]);
    return out;
}

export default function ReportPanel({
    source,
    target,
    heuristic,
    normalResult,
    onClose,
    onShowResult,
    fetchWeights,
}: ReportPanelProps) {
    const [congestionEdges, setCongestionEdges] = useState<CongestionEdge[]>([]);
    const [congestedResult, setCongestedResult] = useState<DetailedPathResult | null>(null);
    const congestedRef = useRef<DetailedPathResult | null>(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewing, setViewing] = useState<"normal" | "congested">("normal");

    const pathEdges = useMemo(() => edgesFromPath(normalResult.path), [normalResult.path]);

    const edgesRef = useRef<CongestionEdge[]>([]);
    useEffect(() => {
        edgesRef.current = congestionEdges;
    }, [congestionEdges]);

    useEffect(() => {
        (async () => {
            try {
                const w = await invoke<Record<string, number>>("get_weights");
                const candidates: CongestionEdge[] = pathEdges.map(([u, v]) => {
                    const original = w[`${u},${v}`] ?? w[`${v},${u}`] ?? 1.0;
                    return { u, v, originalWeight: original, multiplier: 3, enabled: false };
                });
                setCongestionEdges(candidates);
            } catch (e) {
                setError(String(e));
            }
        })();
    }, [pathEdges]);

    useEffect(() => {
        return () => {
            const toRestore = edgesRef.current.filter(e => e.enabled);
            (async () => {
                for (const e of toRestore) {
                    await invoke("set_weight", { u: e.u, v: e.v, weight: e.originalWeight }).catch(console.error);
                }
                await fetchWeights().catch(console.error);
            })();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleEdge = (idx: number) =>
        setCongestionEdges(prev => prev.map((e, i) => i === idx ? { ...e, enabled: !e.enabled } : e));

    const setMultiplier = (idx: number, val: number) =>
        setCongestionEdges(prev => prev.map((e, i) => i === idx ? { ...e, multiplier: val } : e));

    const runCongested = async () => {
        setRunning(true);
        setError(null);
        const toApply = congestionEdges.filter(e => e.enabled);

        try {
            for (const e of toApply) {
                await invoke("set_weight", { u: e.u, v: e.v, weight: e.originalWeight * e.multiplier });
            }

            await fetchWeights();

            const result = await invoke<DetailedPathResult | null>("run_a_star", { source, target, heuristic });

            if (!result) {
                setError("Nenhum caminho encontrado no cenário congestionado.");
                for (const e of toApply) {
                    await invoke("set_weight", { u: e.u, v: e.v, weight: e.originalWeight });
                }
                await fetchWeights();
            } else {
                congestedRef.current = result;
                setCongestedResult(result);
                setViewing("congested");
                onShowResult(result, `A* congestionado ${source}→${target}`);
            }
        } catch (e) {
            setError(String(e));
        } finally {
            setRunning(false);
        }
    };

    const switchView = async (v: "normal" | "congested") => {
        setViewing(v);
        const toApply = congestionEdges.filter(e => e.enabled);

        if (v === "normal") {
            for (const e of toApply) {
                await invoke("set_weight", { u: e.u, v: e.v, weight: e.originalWeight });
            }
            await fetchWeights();
            onShowResult(normalResult, `A* ${source}→${target}`);
        } else if (congestedRef.current) {
            for (const e of toApply) {
                await invoke("set_weight", { u: e.u, v: e.v, weight: e.originalWeight * e.multiplier });
            }
            await fetchWeights();
            onShowResult(congestedRef.current, `A* congestionado ${source}→${target}`);
        }
    };

    const divergenceIdx = useMemo(() => {
        const cr = congestedRef.current;
        if (!cr) return -1;
        const a = normalResult.path, b = cr.path;
        const n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
        return a.length === b.length ? -1 : n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [congestedResult, normalResult]);

    const cr = congestedRef.current;
    const maxClosed = cr
        ? Math.max(normalResult.closed.length, cr.closed.length)
        : normalResult.closed.length;

    return (
        <div className="legend-panel" style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: 13 }}>Relatório A*</strong>
                <button className="btn-raised" onClick={onClose} title="Close">✕</button>
            </div>

            {congestedResult && (
                <div className="toggle-pair" style={{ marginBottom: 8 }}>
                    <button className={viewing === "normal" ? "on" : ""} onClick={() => switchView("normal")}>Normal</button>
                    <button className={viewing === "congested" ? "on" : ""} onClick={() => switchView("congested")}>Congestionado</button>
                </div>
            )}

            <div style={{ fontSize: 11, marginBottom: 6 }}>
                <b>Normal:</b> {normalResult.path.join(" → ")} — custo {normalResult.cost.toFixed(1)}
            </div>
            {cr && (
                <div style={{ fontSize: 11, marginBottom: 6 }}>
                    <b>Congestionado:</b> {cr.path.join(" → ")} — custo {cr.cost.toFixed(1)}
                </div>
            )}
            {cr && (
                <div style={{ fontSize: 11, marginBottom: 6, color: divergenceIdx >= 0 ? "#92400e" : "#444" }}>
                    {divergenceIdx >= 0
                        ? <>Diverge no passo {divergenceIdx + 1}: <b>{cr.path[divergenceIdx]}</b> em vez de <b>{normalResult.path[divergenceIdx] ?? "—"}</b></>
                        : "Rotas idênticas."}
                </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>Congestionar trechos:</div>
            <div style={{ maxHeight: 140, overflowY: "auto", fontSize: 11 }}>
                <table style={tableStyle}>
                    <thead><tr><th></th><th>Trecho</th><th>w</th><th>Multiplicar</th></tr></thead>
                    <tbody>
                        {congestionEdges.map((e, idx) => (
                            <tr key={idx}>
                                <td><input type="checkbox" checked={e.enabled} onChange={() => toggleEdge(idx)} /></td>
                                <td>{e.u}→{e.v}</td>
                                <td>{e.originalWeight.toFixed(0)}</td>
                                <td>
                                    <input
                                        type="number"
                                        min={1}
                                        step={0.5}
                                        style={{ width: 40 }}
                                        value={e.multiplier}
                                        disabled={!e.enabled}
                                        onChange={ev => setMultiplier(idx, Number(ev.target.value))}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button
                className="btn-raised primary"
                style={{ marginTop: 6, width: "100%" }}
                onClick={runCongested}
                disabled={running || !congestionEdges.some(e => e.enabled)}
            >
                {running ? "Executando..." : "Rodar A* Congestionado"}
            </button>
            {error && <p style={{ color: "#b00", fontSize: 11 }}>{error}</p>}

            {cr && (
                <>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8 }}>
                        Fechados por nó
                        <span style={{ fontWeight: 400, marginLeft: 6, color: "#666" }}>
                            (norm: {normalResult.closed.length}, cong: {cr.closed.length})
                        </span>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: "auto" }}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th>Nó</th>
                                    <th>g norm</th>
                                    <th>g cong</th>
                                    <th>Δg</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const normMap = new Map(normalResult.closed.map(s => [s.node, s]));
                                    const congMap = new Map(cr.closed.map(s => [s.node, s]));
                                    const allNodes = Array.from(new Set([
                                        ...normalResult.closed.map(s => s.node),
                                        ...cr.closed.map(s => s.node),
                                    ])).sort((a, b) => {
                                        const ga = normMap.get(a)?.dist ?? congMap.get(a)?.dist ?? 0;
                                        const gb = normMap.get(b)?.dist ?? congMap.get(b)?.dist ?? 0;
                                        return ga - gb;
                                    });
                                    return allNodes.map(node => {
                                        const n = normMap.get(node);
                                        const c = congMap.get(node);
                                        const gDiff = n && c ? c.dist - n.dist : null;
                                        const changed = gDiff !== null && Math.abs(gDiff) > 0.5;
                                        const onlyNorm = n && !c;
                                        const onlyCong = !n && c;
                                        const rowStyle: React.CSSProperties = changed
                                            ? { background: "#fff3cd" }
                                            : onlyNorm
                                            ? { background: "#fee2e2" }
                                            : onlyCong
                                            ? { background: "#dcfce7" }
                                            : {};
                                        return (
                                            <tr key={node} style={rowStyle}>
                                                <td><b>{node}</b></td>
                                                <td>{n ? n.dist.toFixed(0) : "—"}</td>
                                                <td>{c ? c.dist.toFixed(0) : "—"}</td>
                                                <td style={{ color: changed ? "#92400e" : onlyNorm ? "#b91c1c" : onlyCong ? "#15803d" : "#999" }}>
                                                    {changed ? (gDiff! > 0 ? `+${gDiff!.toFixed(0)}` : gDiff!.toFixed(0))
                                                        : onlyNorm ? "only norm"
                                                        : onlyCong ? "only cong"
                                                        : "="}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

const panelStyle: React.CSSProperties = {
    position: "absolute", bottom: 0, right: 8, zIndex: 20,
    width: 280, maxHeight: "calc(100% - 16px)", overflowY: "auto",
    background: "#fdfdf8", border: "1px solid #999", boxShadow: "2px 2px 0 #aaa",
    padding: 8, fontFamily: "Georgia, serif",
};

const tableStyle: React.CSSProperties = {
    width: "100%", borderCollapse: "collapse", fontSize: 10,
};