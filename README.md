# Spirit

A procedural first-person walking experience through a luminous forest. Built entirely with raw WebGL2 — no frameworks, no Three.js, no external dependencies.

## The Experience

Walk through a dense, procedurally generated forest rendered as glowing wireframe structures on a dark canvas. Trees grow through recursive branching algorithms, their luminous lines reaching upward while roots spread across rolling terrain. Particles of light climb the branches and drift into the sky.

A winding stone path of rough-cut glowing polygons guides you through seas of animated grain that ripple in waves across the hillside.

Inspired by Studio Ghibli forests rendered in a digital bioluminescent aesthetic.

## Controls

- **Left click** — Walk to that spot
- **Right-click drag** — Rotate camera
- **WASD / Arrow keys** — Direct movement
- **Shift** — Sprint

## Technical

- **WebGL2** with custom shaders (GLSL ES 3.00)
- **Procedural generation** — recursive L-system trees, Perlin noise terrain, chunk-based world loading
- **Post-processing pipeline** — bloom extraction, two-pass gaussian blur, tone mapping, vignette
- **Hand-written Perlin noise** — seeded permutation table, fractal Brownian motion for terrain and placement
- **Particle system** — 800+ particles spawning from trees, drifting upward with wind
- **Rolling grass** — large-scale sine wave wind simulation creating visible grain field waves
- **Zero dependencies** at runtime — only Vite as a dev/build tool

## Development

```bash
npm install
npm run dev
```

## Deploy

Static site — builds to `dist/`. Works on any static host including Vercel.

```bash
npm run build
```
