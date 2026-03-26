# Sprouting Animation Reference

Inspired by [DiscreteVectors](https://github.com/ekimroyrp/260323_DiscreteVectors) ([demo](https://ekimroyrp.github.io/260323_DiscreteVectors/)).

The idea: when chunks load, trees/grass/ferns **grow into existence** instead of popping in.

---

## What to borrow

### 1. Trail Growth Model
Trails grow segment-by-segment from emitter points. Each emitter has a head position, velocity, and accumulated travel distance. New trail points are pushed when travel exceeds a threshold. This incremental growth is directly relevant — trees could grow branch-by-branch similarly.

### 2. Curl Noise (for particles)
Divergence-free 3D vector field for organic swirling motion:
- 3 independent simplex noise fields, curl computed via finite differences
- Multi-octave FBM (fractal brownian motion) with configurable octaves, lacunarity, gain
- Domain warping adds secondary distortion
- Time-varying for animation
- Could replace our linear particle drift with something more organic (fireflies in eddies)

### 3. Growth Parameters That Control Feel
```
growthSpeed: 2.0          // simulation rate multiplier
generationDistance: 0.05  // distance between trail points
noiseScale: 0.5           // spatial frequency of curl noise
noiseSpeed: 1.2           // temporal animation speed
noiseStrength: 1.0        // curl force magnitude
vorticity: 0.0            // swirl intensity
octaves: 1                // FBM detail layers
damping: 0.0              // velocity decay
```

---

## How to implement in Spirit Ivory

**Approach: pure shader work, no new geometry or draw calls.**

### Trees (biggest impact)
- Each tree gets a `birthTime` when its chunk spawns
- Branch vertex shader: compare `birthTime + branchDepth * delay` vs current time
- Vertices beyond the growth frontier collapse to their parent position (or alpha to 0)
- Result: trees grow from ground up, branches unfurl in cascade over ~1-2 seconds
- Each L-system recursion level delays slightly for natural staggering

### Grass
- Blades rise from zero height with a staggered wave
- Use per-blade offset based on position hash so they don't all grow in sync
- Wave front moves outward from chunk center

### Ferns
- Same as trees, smaller scale

### Particles
- Could add curl noise to existing wind-based drift
- Makes firefly movement more organic and swirling vs linear

---

## What NOT to use
- The chaotic explosion aesthetic — Spirit Ivory needs restraint and atmosphere
- Three.js — we're raw WebGL2
- Mesh/swept-profile rendering — we use wireframe
- Discrete vector snapping — we want smooth organic curves
- Swarm behaviors (alignment, divergence) — overkill for our use case

---

## Key source files from DiscreteVectors

**Repo:** https://github.com/ekimroyrp/260323_DiscreteVectors

- `src/core/swarmTrailsEngine.ts` — The core simulation: curl noise sampling (`sampleCurl`), discrete direction snapping (`findNearestDiscreteDirection`), trail point accumulation (`pushTrailPoint`), swarm forces (alignment/divergence via spatial hash buckets)
- `src/core/trailMeshBuilder.ts` — Converts trail points to tube mesh: Catmull-Rom smoothing, parallel transport tangent frames, square profile extrusion, per-trail gradient vertex colors
- `src/main.ts` — Three.js setup, UI bindings, animation loop, bloom post-processing

### Curl noise algorithm (condensed)
```
sample 3 independent FBM noise fields at (x,y,z,t)
apply domain warping (optional secondary distortion)
compute curl via finite differences:
  curl.x = dFz/dy - dFy/dz
  curl.y = dFx/dz - dFz/dx
  curl.z = dFy/dx - dFx/dy
scale by strength * vorticity
```

### Trail growth algorithm (condensed)
```
each frame:
  for each emitter:
    sample curl noise at head position → acceleration
    add attraction/repulsion forces toward centroid
    velocity = velocity * damping + acceleration * dt
    head += velocity * dt
    accumulate travel distance
    if travel >= generationDistance:
      snap direction to nearest discrete vector (we'd skip this)
      push new trail point
      reset travel accumulator
```
