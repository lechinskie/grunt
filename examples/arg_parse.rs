use clap::Parser;
use grunt::graph::Graph;
use std::collections::HashMap;

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    config: String,
}

fn parse_graph(s: &str) -> Result<Graph, String> {
    let trimmed = s.trim_matches(|c| c == '<' || c == '>');

    let parts: Vec<&str> = trimmed
        .split("},{")
        .map(|p| p.trim_matches(|c| c == '{' || c == '}'))
        .collect();

    if parts.is_empty() {
        return Err("Input cannot be empty".to_string());
    }

    let vertices = parts[0]
        .split(',')
        .map(|v| v.trim().parse::<u32>().map_err(|e| e.to_string()))
        .collect::<Result<Vec<u32>, String>>()?;

    let mut weights: HashMap<(u32, u32), f64> = HashMap::new();

    let mut edges = Vec::new();
    for edge_str in &parts[1..] {
        let nodes: Vec<u32> = edge_str
            .split(',')
            .map(|n| n.trim().parse::<u32>().map_err(|e| e.to_string()))
            .collect::<Result<Vec<u32>, String>>()?;

        if nodes.len() != 2 {
            return Err(format!("Edge {:?} must have exactly 2 nodes", nodes));
        }
        edges.push((nodes[0], nodes[1]));
        weights.entry((nodes[0], nodes[1])).or_insert(1.0);
    }

    Ok(Graph::from_edges(false, vertices, edges, weights))
}

fn main() {
    let args = Args::parse();
    let graph = parse_graph(&args.config).unwrap();

    print!("{:#?}", graph.bfs(0));
}
