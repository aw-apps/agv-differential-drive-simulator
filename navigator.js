// Dynamic Window Approach (DWA) Navigator
class Navigator {
  constructor(agv, obstacles, target) {
    this.agv = agv;
    this.obstacles = obstacles;
    this.target = target;

    this.V_MAX = 0.942;        // m/s
    this.OMEGA_MAX = 2.0;      // rad/s
    this.V_SAMPLES = 15;
    this.OMEGA_SAMPLES = 21;
    this.GOAL_THRESHOLD = 0.5; // m
    this.SAFETY_MARGIN = 0.8;  // m

    // Scoring weights
    this._alpha = 0.5; // heading
    this._beta  = 0.4; // clearance
    this._gamma = 0.1; // velocity

    // Stuck detection
    this._stuckFrames = 0;
    this._recoveryFrames = 0;
    this._lastX = null;
    this._lastY = null;
  }

  hasArrived() {
    if (!this.target) return false;
    const dx = this.target.x - this.agv.x;
    const dy = this.target.y - this.agv.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.GOAL_THRESHOLD;
  }

  computeStep(dt) {
    if (!this.target) return null;
    if (this.hasArrived()) return null;

    const agv = this.agv;
    const obstacles = this.obstacles;
    const target = this.target;

    // Stuck detection: track motion each step
    if (this._lastX !== null) {
      const moved = Math.sqrt(
        (agv.x - this._lastX) ** 2 + (agv.y - this._lastY) ** 2
      );
      if (moved < 0.02) {
        this._stuckFrames++;
      } else {
        this._stuckFrames = 0;
      }
    }
    this._lastX = agv.x;
    this._lastY = agv.y;

    // Recovery mode: allow backward motion for ~60 frames (1 second at 60fps)
    const inRecovery = this._stuckFrames > 30;
    if (inRecovery) {
      this._recoveryFrames++;
      if (this._recoveryFrames > 60) {
        this._stuckFrames = 0;
        this._recoveryFrames = 0;
      }
    } else {
      this._recoveryFrames = 0;
    }

    const vMin = inRecovery ? -this.V_MAX * 0.3 : 0;

    let bestScore = -Infinity;
    let bestV = 0;
    let bestOmega = 0;

    for (let vi = 0; vi < this.V_SAMPLES; vi++) {
      const v = vMin + (vi / (this.V_SAMPLES - 1)) * (this.V_MAX - vMin);

      for (let wi = 0; wi < this.OMEGA_SAMPLES; wi++) {
        const omega = -this.OMEGA_MAX + (wi / (this.OMEGA_SAMPLES - 1)) * 2 * this.OMEGA_MAX;

        // Simulate forward 0.5s in 5 steps of 0.1s each
        let sx = agv.x;
        let sy = agv.y;
        let sTheta = agv.theta;
        const simDt = 0.1;
        let collide = false;

        for (let step = 0; step < 5; step++) {
          sx += v * Math.cos(sTheta) * simDt;
          sy += v * Math.sin(sTheta) * simDt;
          sTheta += omega * simDt;

          if (_agvClearance(sx, sy, sTheta, obstacles) < this.SAFETY_MARGIN) {
            collide = true;
            break;
          }
        }

        if (collide) continue;

        // heading_score: 1 - |angle_to_goal - theta_after_step| / π
        const angleToGoal = Math.atan2(target.y - sy, target.x - sx);
        let headingDiff = Math.abs(angleToGoal - sTheta);
        while (headingDiff > Math.PI) headingDiff = Math.abs(headingDiff - 2 * Math.PI);
        const headingScore = 1 - headingDiff / Math.PI;

        // clearance_score: min(dist_to_obstacles) / 5.0 capped at 1.0
        const clearance = _agvClearance(sx, sy, sTheta, obstacles);
        const clearanceScore = Math.min(clearance / 5.0, 1.0);

        // velocity_score: v / V_MAX; penalise reverse so it's only chosen when needed
        const velocityScore = v >= 0 ? v / this.V_MAX : v / this.V_MAX * 0.3;

        const score = this._alpha * headingScore
          + this._beta * clearanceScore
          + this._gamma * velocityScore;

        if (score > bestScore) {
          bestScore = score;
          bestV = v;
          bestOmega = omega;
        }
      }
    }

    // Convert (v, omega) to wheel speeds: vR = v + ω×L/2, vL = v - ω×L/2
    const L = agv.WHEELBASE;
    agv.vR = bestV + bestOmega * L / 2;
    agv.vL = bestV - bestOmega * L / 2;

    // Clamp to max wheel speed
    const maxWS = agv.MAX_WHEEL_SPEED;
    agv.vR = Math.max(-maxWS, Math.min(maxWS, agv.vR));
    agv.vL = Math.max(-maxWS, Math.min(maxWS, agv.vL));

    return { v: bestV, omega: bestOmega };
  }
}

// --- Collision geometry helpers ---

function _pointToAABBDist(px, py, rect) {
  const hw = 0.5, hh = 0.5;
  const dx = Math.max(rect.x - hw - px, 0, px - (rect.x + hw));
  const dy = Math.max(rect.y - hh - py, 0, py - (rect.y + hh));
  return Math.sqrt(dx * dx + dy * dy);
}

function _pointToCircleDist(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy) - r;
}

function _agvClearance(ax, ay, theta, obstacles) {
  if (obstacles.length === 0) return Infinity;

  // 4 corners of the AGV's 1m × 1m body, rotated by heading theta
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const localCorners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const corners = localCorners.map(([lx, ly]) => ({
    x: ax + lx * cos - ly * sin,
    y: ay + lx * sin + ly * cos
  }));

  let minDist = Infinity;
  for (const obs of obstacles) {
    for (const c of corners) {
      const d = obs.shape === 'circle'
        ? _pointToCircleDist(c.x, c.y, obs.x, obs.y, 0.5)
        : _pointToAABBDist(c.x, c.y, obs);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}
