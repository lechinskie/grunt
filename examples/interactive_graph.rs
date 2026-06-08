use grunt::graph::Graph;
use std::io::{self, Write};

fn show_graph(g: &Graph) {
    if g.vertices.is_empty() {
        println!("(grafo vazio)");
        return;
    }

    let mut sorted = g.vertices.clone();
    sorted.sort();

    println!("adjacencia:");
    for &u in &sorted {
        let nbrs = g.neighbors(u);
        if nbrs.is_empty() {
            println!("  {} -> (nenhum)", u);
        } else {
            let mut ns: Vec<u32> = nbrs.to_vec();
            ns.sort();
            let s: Vec<String> = ns.iter().map(|x| x.to_string()).collect();
            println!("  {} -> {}", u, s.join(", "));
        }
    }

    println!("matriz:");
    let m = g.adjacency_matrix();
    print!("    ");
    for &v in &sorted {
        print!("{:3}", v);
    }
    println!();
    for &u in &sorted {
        let i = g.vertices.iter().position(|&x| x == u).unwrap();
        print!("{:3} ", u);
        for &v in &sorted {
            let j = g.vertices.iter().position(|&x| x == v).unwrap();
            print!("{:3}", m[(i, j)]);
        }
        println!();
    }
}

fn print_path(label: &str, path: &[u32]) {
    let s: Vec<String> = path.iter().map(|v| v.to_string()).collect();
    println!("{}: {}", label, s.join(" -> "));
}

fn help() {
    println!("comandos:");
    println!("  v 1 2 3        adicionar vertices");
    println!("  e 1-2 2-3      adicionar arcos");
    println!("  bfs 1          busca em largura a partir de 1");
    println!("  dfs 1          busca em profundidade a partir de 1");
    println!("  tc 1           fecho transitivo direto de 1");
    println!("  tci 1          fecho transitivo indireto de 1");
    println!("  nb 1           vizinhos de 1");
    println!("  show           exibir grafo");
    println!("  undir          tornar o grafo nao-dirigido");
    println!("  reset          novo grafo");
    println!("  q              sair");
}

fn prompt(msg: &str) -> String {
    print!("{}", msg);
    io::stdout().flush().unwrap();
    let mut buf = String::new();
    io::stdin().read_line(&mut buf).unwrap();
    buf.trim().to_owned()
}

fn main() {
    let mut g = Graph::new();
    help();
    println!();

    loop {
        let line = prompt("> ");
        let mut parts = line.splitn(2, ' ');
        let cmd = parts.next().unwrap_or("").trim();
        let args = parts.next().unwrap_or("").trim();

        match cmd {
            "v" => {
                for tok in args.split_whitespace() {
                    if let Ok(v) = tok.parse::<u32>() {
                        if !g.add_vertex(v) {
                            println!("{} ja existe", v);
                        }
                    } else {
                        println!("'{}' invalido", tok);
                    }
                }
                show_graph(&g);
            }

            "e" => {
                for tok in args.split_whitespace() {
                    let p: Vec<&str> = tok.split('-').collect();
                    if p.len() == 2 {
                        if let (Ok(u), Ok(v)) = (p[0].parse::<u32>(), p[1].parse::<u32>()) {
                            if !g.add_edge(u, v, 1.0) {
                                println!("{}-{} ignorado (dup. ou vertice inexistente)", u, v);
                            }
                        } else {
                            println!("'{}' invalido", tok);
                        }
                    } else {
                        println!("formato: u-v (ex: 1-2)");
                    }
                }
                show_graph(&g);
            }

            "bfs" => match args.parse::<u32>() {
                Ok(s) if g.vertices.contains(&s) => {
                    let p = g.bfs(s);
                    print_path("BFS", &p);
                }
                Ok(s) => println!("{} nao existe", s),
                Err(_) => println!("uso: bfs <vertice>"),
            },

            "dfs" => match args.parse::<u32>() {
                Ok(s) if g.vertices.contains(&s) => {
                    let p = g.dfs(s);
                    print_path("DFS", &p);
                }
                Ok(s) => println!("{} nao existe", s),
                Err(_) => println!("uso: dfs <vertice>"),
            },

            "tc" => match args.parse::<u32>() {
                Ok(v) if g.vertices.contains(&v) => {
                    let r = g.transitive_closure_direct(v);
                    if r.is_empty() {
                        println!("nenhum vertice alcancavel a partir de {}", v);
                    } else {
                        let s: Vec<String> = r.iter().map(|x| x.to_string()).collect();
                        println!("tc direto de {} -> {{{}}}", v, s.join(", "));
                    }
                }
                Ok(v) => println!("{} nao existe", v),
                Err(_) => println!("uso: tc <vertice>"),
            },

            "tci" => match args.parse::<u32>() {
                Ok(v) if g.vertices.contains(&v) => {
                    let r = g.transitive_closure_indirect(v);
                    if r.is_empty() {
                        println!("nenhum vertice alcanca {}", v);
                    } else {
                        let s: Vec<String> = r.iter().map(|x| x.to_string()).collect();
                        println!("tc indireto de {} <- {{{}}}", v, s.join(", "));
                    }
                }
                Ok(v) => println!("{} nao existe", v),
                Err(_) => println!("uso: tci <vertice>"),
            },

            "nb" => match args.parse::<u32>() {
                Ok(v) if g.vertices.contains(&v) => {
                    let nbrs = g.neighbors(v);
                    if nbrs.is_empty() {
                        println!("{}: sem vizinhos", v);
                    } else {
                        let s: Vec<String> = nbrs.iter().map(|x| x.to_string()).collect();
                        println!("{}: {}", v, s.join(", "));
                    }
                }
                Ok(v) => println!("{} nao existe", v),
                Err(_) => println!("uso: nb <vertice>"),
            },

            "show" => show_graph(&g),

            "undir" => {
                g = g.undirected();
                show_graph(&g);
            }

            "reset" => {
                g = Graph::new();
                println!("grafo resetado");
            }

            "help" | "h" => help(),

            "q" | "quit" | "exit" => break,

            "" => {}

            _ => println!("comando desconhecido. 'help' para ajuda"),
        }
    }
}
