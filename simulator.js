class Simulator {
  constructor(map) {
    this.map = map;
    this.agv = new AGV();
    this.navigator = null;
    this.obstacles = [];
    this.target = null;
    this.running = false;
    this.speedMultiplier = 1;

    this._rafId = null;
    this._ctx = map.canvas.getContext('2d');
    this._dt = 1 / 60;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.navigator = new Navigator(this.agv, this.obstacles, this.target);
    this._loop();
  }

  pause() {
    this.running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  reset() {
    this.pause();
    this.agv = new AGV();
    this.navigator = null;
    this.target = null;
    this.obstacles = [];
    this._render();
    this._updateTelemetry();
    this._updateStatus('idle');
  }

  setTarget(worldX, worldY) {
    this.target = { x: worldX, y: worldY };
    if (!this.running) this._render();
  }

  addObstacle(obs) {
    this.obstacles.push(obs);
    if (!this.running) this._render();
  }

  removeObstacle(index) {
    this.obstacles.splice(index, 1);
    if (!this.running) this._render();
  }

  clearObstacles() {
    this.obstacles = [];
    if (!this.running) this._render();
  }

  _loop() {
    if (!this.running) return;

    const steps = Math.max(1, Math.round(this.speedMultiplier));
    for (let i = 0; i < steps; i++) {
      if (this.navigator) {
        if (this.navigator.hasArrived()) {
          this.agv.vL = 0;
          this.agv.vR = 0;
          this.running = false;
          this._render();
          this._updateTelemetry();
          this._updateStatus('arrived');
          return;
        }
        const result = this.navigator.computeStep(this._dt);
        // Determine status: avoiding if clearance is low
        if (result) {
          const clearance = _agvClearance(this.agv.x, this.agv.y, this.obstacles);
          this._navStatus = clearance < 1.5 ? 'avoiding' : 'running';
        }
      }
      this.agv.update(this._dt);
    }

    this._render();
    this._updateTelemetry();
    this._updateStatus(this._navStatus || 'running');
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _render() {
    this.map.render(this._ctx, this.agv, this.obstacles, this.target);
  }

  _updateTelemetry() {
    const t = this.agv.getTelemetry();
    const el = (id) => document.getElementById(id);
    el('tel-x').textContent = t.x.toFixed(2) + ' m';
    el('tel-y').textContent = t.y.toFixed(2) + ' m';
    el('tel-v').textContent = t.v.toFixed(1) + ' mm/s';
    el('tel-w').textContent = t.omega.toFixed(3) + ' rad/s';
    el('tel-lrpm').textContent = t.lRPM.toFixed(1);
    el('tel-rrpm').textContent = t.rRPM.toFixed(1);
    el('tel-drpm').textContent = t.deltaRPM.toFixed(1);
  }

  _updateStatus(state) {
    const badge = document.getElementById('status-badge');
    if (!badge) return;
    const map = {
      idle:    { cls: 'badge idle',    text: '待機' },
      running: { cls: 'badge running', text: '運行中' },
      avoiding:{ cls: 'badge avoiding',text: '避障中' },
      arrived: { cls: 'badge arrived', text: '到達' }
    };
    const s = map[state] || map.idle;
    badge.className = s.cls;
    badge.textContent = s.text;
  }
}
