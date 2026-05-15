use grunt::graph::Graph;
use serde::Serialize;
use std::{collections::HashMap, sync::Mutex};
use tauri::State;

pub struct AppState {
    pub graph: Mutex<Graph>,
}

#[derive(Serialize, Clone)]
pub struct GraphSnapshot {
    pub vertices: Vec<u32>,
    pub edges: Vec<[u32; 2]>,
    pub directed: bool,
}

#[derive(Serialize)]
pub struct ConnectivityResult {
    pub is_connected: bool,
    pub components: Vec<Vec<u32>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ColoringResult {
    pub coloring: HashMap<u32, usize>,
    pub num_colors: usize,
    pub color_classes: Vec<Vec<u32>>,
    pub order: Vec<u32>,
}

fn snapshot(g: &Graph) -> GraphSnapshot {
    let edges = if g.directed {
        g.edges.iter().map(|&(u, v)| [u, v]).collect()
    } else {
        let mut seen = std::collections::HashSet::new();
        g.edges
            .iter()
            .filter(|&&(u, v)| seen.insert((u.min(v), u.max(v))))
            .map(|&(u, v)| [u, v])
            .collect()
    };
    GraphSnapshot {
        vertices: g.vertices.clone(),
        edges,
        directed: g.directed,
    }
}

fn err(msg: impl Into<String>) -> String {
    msg.into()
}

#[tauri::command]
fn get_state(state: State<AppState>) -> GraphSnapshot {
    snapshot(&state.graph.lock().unwrap())
}

#[tauri::command]
fn set_directed(state: State<AppState>, directed: bool) -> GraphSnapshot {
    let mut g = state.graph.lock().unwrap();
    let vertices = g.vertices.clone();
    *g = if directed {
        Graph::new()
    } else {
        Graph::new_undirected()
    };
    for v in vertices {
        g.add_vertex(v);
    }
    snapshot(&g)
}

#[tauri::command]
fn reset_graph(state: State<AppState>) -> GraphSnapshot {
    let mut g = state.graph.lock().unwrap();
    let directed = g.directed;
    *g = if directed {
        Graph::new()
    } else {
        Graph::new_undirected()
    };
    snapshot(&g)
}

#[tauri::command]
fn add_vertex(state: State<AppState>, v: u32) -> Result<GraphSnapshot, String> {
    let mut g = state.graph.lock().unwrap();
    if !g.add_vertex(v) {
        return Err(err(format!("Vertex {v} already exists")));
    }
    Ok(snapshot(&g))
}

#[tauri::command]
fn remove_vertex(state: State<AppState>, v: u32) -> Result<GraphSnapshot, String> {
    let mut g = state.graph.lock().unwrap();
    if !g.remove_vertex(v) {
        return Err(err(format!("Vertex {v} not found")));
    }
    Ok(snapshot(&g))
}

#[tauri::command]
fn add_edge(state: State<AppState>, u: u32, v: u32) -> Result<GraphSnapshot, String> {
    let mut g = state.graph.lock().unwrap();
    if !g.add_edge(u, v) {
        return Err(err(format!(
            "Could not add edge ({u}, {v}) — vertices must exist and edge must not be a duplicate"
        )));
    }
    Ok(snapshot(&g))
}

#[tauri::command]
fn remove_edge(state: State<AppState>, u: u32, v: u32) -> Result<GraphSnapshot, String> {
    let mut g = state.graph.lock().unwrap();
    if !g.remove_edge(u, v) {
        return Err(err(format!("Edge ({u}, {v}) not found")));
    }
    Ok(snapshot(&g))
}

#[tauri::command]
fn run_bfs(state: State<AppState>, start: u32) -> Result<Vec<u32>, String> {
    let g = state.graph.lock().unwrap();
    if !g.vertices.contains(&start) {
        return Err(err(format!("Vertex {start} not found")));
    }
    Ok(g.bfs(start))
}

#[tauri::command]
fn run_dfs(state: State<AppState>, start: u32) -> Result<Vec<u32>, String> {
    let g = state.graph.lock().unwrap();
    if !g.vertices.contains(&start) {
        return Err(err(format!("Vertex {start} not found")));
    }
    Ok(g.dfs(start))
}

#[tauri::command]
fn get_transitive_direct(state: State<AppState>, v: u32) -> Result<Vec<u32>, String> {
    let g = state.graph.lock().unwrap();
    if !g.vertices.contains(&v) {
        return Err(err(format!("Vertex {v} not found")));
    }
    Ok(g.transitive_closure_direct(v))
}

#[tauri::command]
fn get_transitive_indirect(state: State<AppState>, v: u32) -> Result<Vec<u32>, String> {
    let g = state.graph.lock().unwrap();
    if !g.vertices.contains(&v) {
        return Err(err(format!("Vertex {v} not found")));
    }
    Ok(g.transitive_closure_indirect(v))
}

#[tauri::command]
fn check_connectivity(state: State<AppState>) -> ConnectivityResult {
    let g = state.graph.lock().unwrap();
    ConnectivityResult {
        is_connected: g.is_connected(),
        components: g.strongly_connected_components(),
    }
}

#[tauri::command]
fn run_coloring(state: tauri::State<AppState>) -> ColoringResult {
    let (coloring, order) = state.graph.lock().unwrap().color();
    let num_colors = coloring.values().max().map(|&m| m + 1).unwrap_or(0);

    let mut color_classes: Vec<Vec<u32>> = vec![vec![]; num_colors];
    for (&v, &c) in &coloring {
        color_classes[c].push(v);
    }
    for class in &mut color_classes {
        class.sort_unstable();
    }
    ColoringResult {
        coloring,
        num_colors,
        color_classes,
        order,
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            graph: Mutex::new(Graph::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            set_directed,
            reset_graph,
            add_vertex,
            remove_vertex,
            add_edge,
            remove_edge,
            run_bfs,
            run_dfs,
            get_transitive_direct,
            get_transitive_indirect,
            check_connectivity,
            run_coloring,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
