use nalgebra::DMatrix;
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone)]
pub struct Graph {
    pub vertices: Vec<u32>,
    pub edges: Vec<(u32, u32)>,
    pub adjacency: HashMap<u32, Vec<u32>>,
    pub directed: bool,
}

impl Graph {
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            edges: Vec::new(),
            adjacency: HashMap::new(),
            directed: true,
        }
    }

    pub fn new_undirected() -> Self {
        Self {
            directed: false,
            ..Self::new()
        }
    }

    pub fn from_edges(directed: bool, vertices: Vec<u32>, edges: Vec<(u32, u32)>) -> Self {
        let mut adjacency: HashMap<u32, Vec<u32>> =
            vertices.iter().map(|&v| (v, Vec::new())).collect();

        for (u, v) in edges.clone() {
            adjacency.entry(u).or_default().push(v);
        }

        Self {
            vertices: vertices.clone(),
            edges: edges.clone(),
            adjacency,
            directed,
        }
    }

    pub fn add_vertex(&mut self, v: u32) -> bool {
        if self.vertices.contains(&v) {
            return false;
        }
        self.vertices.push(v);
        self.adjacency.insert(v, Vec::new());
        true
    }

    pub fn remove_vertex(&mut self, v: u32) -> bool {
        if !self.vertices.contains(&v) {
            return false;
        }
        self.vertices.retain(|&x| x != v);
        self.adjacency.remove(&v);
        for neighbors in self.adjacency.values_mut() {
            neighbors.retain(|&x| x != v);
        }
        self.edges.retain(|&(u, w)| u != v && w != v);
        true
    }

    pub fn add_edge(&mut self, u: u32, v: u32) -> bool {
        if !self.vertices.contains(&u) || !self.vertices.contains(&v) {
            return false;
        }
        if self.edges.contains(&(u, v)) {
            return false;
        }
        self.edges.push((u, v));
        self.adjacency.entry(u).or_default().push(v);

        if !self.directed && u != v && !self.edges.contains(&(v, u)) {
            self.edges.push((v, u));
            self.adjacency.entry(v).or_default().push(u);
        }

        true
    }

    pub fn remove_edge(&mut self, u: u32, v: u32) -> bool {
        if !self.edges.contains(&(u, v)) {
            return false;
        }
        self.edges.retain(|&e| e != (u, v));
        self.adjacency.entry(u).or_default().retain(|&x| x != v);

        if !self.directed {
            self.edges.retain(|&e| e != (v, u));
            self.adjacency.entry(v).or_default().retain(|&x| x != u);
        }

        true
    }

    pub fn undirected(&self) -> Graph {
        let edges_to_add: Vec<(u32, u32)> = self
            .edges
            .iter()
            .filter(|&&(u, v)| u != v && !self.edges.contains(&(v, u)))
            .map(|&(u, v)| (v, u))
            .collect();

        let mut ng = self.clone();
        for (u, v) in edges_to_add {
            ng.add_edge(u, v);
        }
        ng
    }

    pub fn adjacency_matrix(&self) -> DMatrix<u32> {
        let n = self.vertices.len();
        let mut m = DMatrix::zeros(n, n);

        for &(u, v) in &self.edges {
            let i = self.vertices.iter().position(|&x| x == u);
            let j = self.vertices.iter().position(|&x| x == v);

            if let (Some(row), Some(col)) = (i, j) {
                m[(row, col)] = 1;
            }
        }
        m
    }

    pub fn neighbors(&self, v: u32) -> &[u32] {
        self.adjacency.get(&v).map(|s| s.as_slice()).unwrap_or(&[])
    }

    pub fn bfs(&self, s: u32) -> Vec<u32> {
        let mut f = VecDeque::new();
        let mut x = HashSet::new();
        let mut o = Vec::new();

        f.push_back(s);
        x.insert(s);

        while let Some(v) = f.pop_front() {
            o.push(v);
            for &n in self.neighbors(v) {
                if x.insert(n) {
                    f.push_back(n);
                }
            }
        }
        o
    }

    pub fn dfs(&self, s: u32) -> Vec<u32> {
        let mut f = Vec::new();
        let mut x = HashSet::new();
        let mut o = Vec::new();

        f.push(s);
        x.insert(s);

        while let Some(v) = f.pop() {
            o.push(v);
            for &n in self.neighbors(v) {
                if x.insert(n) {
                    f.push(n);
                }
            }
        }
        o
    }

    pub fn transitive_closure_direct(&self, v: u32) -> Vec<u32> {
        let tc = self.mmb();
        let row = self
            .vertices
            .iter()
            .position(|&x| x == v)
            .expect("Vertex not in graph");
        self.vertices
            .iter()
            .enumerate()
            .filter(|&(j, _)| tc[(row, j)] > 0)
            .map(|(_, &u)| u)
            .collect()
    }

    pub fn transitive_closure_indirect(&self, v: u32) -> Vec<u32> {
        let tc = self.mmb();
        let col = self
            .vertices
            .iter()
            .position(|&x| x == v)
            .expect("Vertex not in graph");
        self.vertices
            .iter()
            .enumerate()
            .filter(|&(i, _)| tc[(i, col)] > 0)
            .map(|(_, &u)| u)
            .collect()
    }

    // https://jn.inf.ethz.ch/education/script/P3_C11.pdf
    // probably the same as warshall? the implementation is the same but didnt see any direct
    // mention
    //
    //Let A, B, C be n x n boolean matrices defined by
    //type nnboolean: array[1 .. n, 1 .. n] of boolean;
    //var A, B, C: nnboolean;
    //The boolean matrix multiplication C = A . B is defined as
    //C[i, j] = OR _from k 1 to n_ (A[i, k] and B[k, j])
    //but since we're trying to power here to define rechables A and B are the adjacency_matrix
    fn mmb(&self) -> DMatrix<u32> {
        let n = self.vertices.len();
        let mut tc = self.adjacency_matrix();
        for k in 0..n {
            for i in 0..n {
                for j in 0..n {
                    if tc[(i, k)] > 0 && tc[(k, j)] > 0 {
                        tc[(i, j)] = 1;
                    }
                }
            }
        }
        tc
    }

    pub fn is_connected(&self) -> bool {
        if self.vertices.is_empty() {
            return true;
        }
        self.undirected().bfs(self.vertices[0]).len() == self.vertices.len()
    }

    pub fn connected_components(&self) -> Vec<Vec<u32>> {
        let ug = self.undirected();
        let mut visited: HashSet<u32> = HashSet::new();
        let mut components = Vec::new();

        for &v in &self.vertices {
            if visited.contains(&v) {
                continue;
            }
            let comp = ug.bfs(v);
            for &u in &comp {
                visited.insert(u);
            }
            components.push(comp);
        }
        components
    }

    pub fn strongly_connected_components(&self) -> Vec<Vec<u32>> {
        if !self.directed {
            return self.connected_components();
        }

        let mut assigned: HashSet<u32> = HashSet::new();
        let mut sccs = Vec::new();

        for &v in &self.vertices {
            if assigned.contains(&v) {
                continue;
            }
            let reachable_from_v: HashSet<u32> = self.bfs(v).into_iter().collect();
            let mut scc: Vec<u32> = reachable_from_v
                .iter()
                .cloned()
                .filter(|&u| self.bfs(u).contains(&v))
                .collect();
            scc.sort_unstable();
            for &u in &scc {
                assigned.insert(u);
            }
            sccs.push(scc);
        }
        sccs
    }

    // Heuristic:
    // Init (first vertice):
    //  Choose the most connected vertice
    //
    // 2nd Step:
    //  Choose to color the vertice, within the moment, is adjacent for colored vertices with the
    //  greatest saturation order
    //  repeat.
    //
    //> Notes:
    //>  In dispute cases, we select the most connected _or_ the first listed.
    //>  The colors are numered, always choose the minor possible.
    pub fn color(&self) -> (HashMap<u32, usize>, Vec<u32>) {
        if self.vertices.is_empty() {
            return (HashMap::new(), Vec::new());
        }

        // doesnt matter if it is directed or not in that case?
        let ug = if self.directed {
            self.undirected()
        } else {
            self.clone()
        };

        let degree: HashMap<u32, usize> = self
            .vertices
            .iter()
            .map(|&v| (v, ug.neighbors(v).len()))
            .collect();

        let mut coloring: HashMap<u32, usize> = HashMap::new();
        let mut order = Vec::new();

        // saturation[v] = set of distinct colors that v sees
        let mut saturation: HashMap<u32, HashSet<usize>> =
            self.vertices.iter().map(|&v| (v, HashSet::new())).collect();

        let mut uncolored: Vec<u32> = self.vertices.clone();

        // Init
        let first_idx = uncolored
            .iter()
            .enumerate()
            .max_by_key(|(_, v)| degree[v])
            .map(|(i, _)| i)
            .unwrap();
        let first = uncolored.remove(first_idx);

        coloring.insert(first, 0);
        order.push(first);
        for &nb in ug.neighbors(first) {
            saturation.entry(nb).or_default().insert(0);
        }

        while !uncolored.is_empty() {
            // 2nd step
            let next_idx = uncolored
                .iter()
                .enumerate()
                .max_by_key(|(_, v)| (saturation[v].len(), degree[v]))
                // greatest saturation or degree on disputes (fallback to first encountered)
                .map(|(i, _)| i)
                .unwrap();
            let next = uncolored.remove(next_idx);

            let neighbor_colors: HashSet<usize> = ug
                .neighbors(next)
                .iter()
                .filter_map(|nb| coloring.get(nb))
                .cloned()
                .collect();

            let color = (0..).find(|c| !neighbor_colors.contains(c)).unwrap(); // minimum color possible
            coloring.insert(next, color);
            order.push(next);

            for &nb in ug.neighbors(next) {
                // i just care about uncolereds at that point
                if !coloring.contains_key(&nb) {
                    saturation.entry(nb).or_default().insert(color);
                }
            }
        }
        (coloring, order)
    }
}

impl Default for Graph {
    fn default() -> Self {
        Self::new()
    }
}
