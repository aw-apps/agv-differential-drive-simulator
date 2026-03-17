# AGENTS.md — AGV Differential Drive Simulator

## Goal
Build a real-time, browser-based simulation platform for a two-wheel differential drive AGV navigating a 50m×50m map with dynamic obstacle avoidance, telemetry display, and interactive controls. Deployed as a static GitHub Pages site.

## Tech Stack
- Pure HTML5 + CSS3 + Vanilla JavaScript (ES6+)
- HTML5 Canvas API for rendering
- No external frameworks or dependencies
- GitHub Pages deployment from `main` branch root

## Architecture

### File Structure
```
index.html       — Main entry, layout (canvas + sidebar)
style.css        — All styles
simulator.js     — Core simulation engine
agv.js           — AGV physics, differential drive kinematics
navigator.js     — Path planning & obstacle avoidance (DWA or VFH)
map.js           — Map renderer, grid, obstacles, coordinate transforms
ui.js            — UI event handlers, telemetry panel, controls
```

### Key Components

**Map (map.js)**
- World: 50m × 50m Cartesian coordinate system
- Viewport: pan & zoom, pixel↔world coordinate transform
- Grid lines every 1m, labeled axes
- Renders obstacles (1m square / 1m diameter circle) and target marker

**AGV Physics (agv.js)**
- Unicycle/differential drive model:
  - v = (v_r + v_l) / 2  (linear velocity)
  - ω = (v_r - v_l) / L  (angular velocity, L = wheelbase = 0.9m)
  - x += v * cos(θ) * dt
  - y += v * sin(θ) * dt
  - θ += ω * dt
- Body: 1m × 1m square footprint centered on (x, y)
- Max wheel speed: 3000 RPM → ~600 mm/s linear
- RPM = (wheel_speed_mm_s / (π * wheel_diameter_mm)) * 60

**Navigator (navigator.js)**
- Algorithm: Dynamic Window Approach (DWA) or Vector Field Histogram (VFH)
- Samples candidate (v, ω) pairs within dynamic window
- Scores by: heading to goal + clearance from obstacles + forward speed
- Output: target (v_l, v_r) for AGV
- Goal reached threshold: 0.5m from target center

**Simulator (simulator.js)**
- requestAnimationFrame game loop
- Speed multiplier: 1× to 15× (simulates multiple dt steps per frame)
- dt = 1/60 s (base timestep)
- Collision detection: AABB vs AABB, AABB vs Circle

**UI (ui.js)**
- Left-click on canvas: place obstacle at world coords
- Right-click on canvas: set target B at world coords
- Sidebar: obstacle list with X/Y inputs, delete button, clear all
- Controls: Start / Pause / Reset buttons
- Telemetry panel: X, Y, V (mm/s), ω (rad/s), L-RPM, R-RPM, Δ-RPM
- Obstacle shape toggle: Square / Circle
- Speed multiplier slider: 1x to 15x

## Global Acceptance Criteria
- [ ] AGV renders as 1m×1m body on the 50m×50m grid map
- [ ] Differential drive physics produce smooth, realistic motion
- [ ] AGV navigates autonomously from start to target B
- [ ] Dynamic obstacle avoidance works in 2m-wide corridors
- [ ] Left-click places obstacles; right-click sets target
- [ ] Telemetry panel shows X, Y, V, ω, L-RPM, R-RPM, ΔRPM in real-time
- [ ] Start / Pause / Reset controls work correctly
- [ ] Speed multiplier (1x–15x) accelerates simulation visually
- [ ] Obstacle sidebar shows list with editable coords + delete
- [ ] No JavaScript errors in browser console
- [ ] Site loads and runs on GitHub Pages without a build step
