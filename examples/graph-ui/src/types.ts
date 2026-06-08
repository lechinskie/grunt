export interface GraphSnapshot {
	vertices: number[];
	edges: [number, number][];
	directed: boolean;
}

export interface ConnectivityResult {
	is_connected: boolean;
	components: number[][];
}

export interface AlgoStep {
	node: number;
	dist: number;
	f: number | null;
}

export interface DetailedPathResult {
	path: number[];
	cost: number;
	closed: AlgoStep[];
}

export type AlgoResult =
	| { kind: "traversal"; label: string; order: number[] }
	| { kind: "closure"; label: string; vertices: number[] }
	| { kind: "connectivity"; data: ConnectivityResult }
	| { kind: "coloring"; data: ColoringResult }
	| { kind: "path"; label: string; path: number[]; cost: number; closed: AlgoStep[] }
	| null;

export interface Pos { x: number; y: number; }

export interface Flash { kind: "err" | "ok"; msg: string; }

export interface EdgeSelection {
	src: number;
	dst: number;
}

export interface GraphHistory {
	vertices: number[];
	edges: [number, number][];
	directed: boolean;
	weights?: Record<string, number>;
}

export interface ColoringResult {
	coloring: Record<number, number>;
	num_colors: number;
	color_classes: number[][];
	order: number[];
}
