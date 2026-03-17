class Simulator {
  constructor(map) {
    this.map = map;
    this.agv = null;
    this.navigator = null;
    this.obstacles = [];
    this.target = null;
    this.running = false;
    this.speedMultiplier = 1;

    this._rafId = null;
    this._ctx = map.canvas.getContext('2d');
  }

  start() {
    if (this.running) return;
    this.running = true;
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
    this.agv = null;
    this.target = null;
    this.obstacles = [];
    this._render();
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
    this._render();
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _render() {
    this.map.render(this._ctx, this.agv, this.obstacles, this.target);
  }
}
