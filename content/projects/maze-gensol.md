---
title: Maze-gensol
tag: Algorithms · C · DFS
date: 2026-11
excerpt: A C based random square maze genarator and solver that uses DFS for traversal and generation
pills:
  - C
  - DFS
slug: maze-gensol
Languages: C
Algorithms: Depth First Search
image: media/uploads/bluhjkjk.jpg
---

# Terminal Maze Generator & Solver

A lightweight, terminal-based square(NxN) maze generator and animated solver written in C. It uses block emojis and ANSI escape codes to render real-time, in-place animations directly in your terminal.

---

## Features

- **Randomized Maze Generation:** Carves solvable mazes using a Recursive Backtracker (Depth-First Search) with a Fisher-Yates shuffle.
- **Custom Binary Format (`.maze`):** Exports generated mazes to compact binary files for reuse.
- **Animated Backtracking Solver:** Visualizes the pathfinding process in real time, highlighting the active path and marking dead ends as it backtracks.
- **Adjustable Speed:** Control the solver's animation speed from `1` (slowest) to `100` (fastest).
- **Batch Solving:** Pass multiple `.maze` files via CLI arguments to solve them sequentially.
