class Obstacle {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type;
    this.shape = type; // backward-compat alias used by navigator.js clearance calc
    this.x = x;
    this.y = y;
  }

  getBounds() {
    if (this.type === 'circle') {
      return { cx: this.x, cy: this.y, r: 0.5 };
    }
    return { cx: this.x, cy: this.y, half: 0.5 };
  }
}

class SimMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.worldSize = 50;

    this.scale = 15; // px/m
    this.panX = 0;
    this.panY = 0;

    this._dragging = false;
    this._dragMoved = false;
    this._dragStart = { x: 0, y: 0 };
    this._panStart = { x: 0, y: 0 };

    this._setupEvents();
    this._initView();
  }

  _initView() {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (cw === 0 || ch === 0) return;
    this.scale = Math.min(cw, ch) / (this.worldSize * 1.1);
    // Center world (25, 25) on canvas center
    this.panX = cw / 2 - 25 * this.scale;
    this.panY = ch / 2 + 25 * this.scale;
  }

  resize() {
    this._initView();
  }

  worldToCanvas(wx, wy) {
    return {
      x: this.panX + wx * this.scale,
      y: this.panY - wy * this.scale
    };
  }

  canvasToWorld(cx, cy) {
    return {
      x: (cx - this.panX) / this.scale,
      y: (this.panY - cy) / this.scale
    };
  }

  _setupEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      this._dragging = true;
      this._dragMoved = false;
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._panStart = { x: this.panX, y: this.panY };
    });

    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this._dragMoved = true;
        canvas.style.cursor = 'grabbing';
      }
      this.panX = this._panStart.x + dx;
      this.panY = this._panStart.y + dy;
    });

    window.addEventListener('mouseup', e => {
      if (e.button !== 0) return;
      this._dragging = false;
      canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.max(0.5, Math.min(50, this.scale * factor));

      this.panX = canvasX - (canvasX - this.panX) * (newScale / this.scale);
      this.panY = canvasY - (canvasY - this.panY) * (newScale / this.scale);
      this.scale = newScale;
    }, { passive: false });
  }

  render(ctx, agv, obstacles, target) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, w, h);

    this._drawGrid(ctx);

    if (obstacles) {
      for (const obs of obstacles) {
        this._drawObstacle(ctx, obs);
      }
    }

    if (target) {
      this._drawTarget(ctx, target);
    }

    this._drawAGV(ctx, agv);
  }

  _drawGrid(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    const tl = this.canvasToWorld(0, 0);
    const br = this.canvasToWorld(w, h);

    const xMin = Math.max(0, Math.floor(Math.min(tl.x, br.x)));
    const xMax = Math.min(this.worldSize, Math.ceil(Math.max(tl.x, br.x)));
    const yMin = Math.max(0, Math.floor(Math.min(tl.y, br.y)));
    const yMax = Math.min(this.worldSize, Math.ceil(Math.max(tl.y, br.y)));

    const skip1m = this.scale < 4;
    const skip5m = this.scale < 0.8;

    ctx.save();

    // Vertical lines
    for (let x = xMin; x <= xMax; x++) {
      const is10 = x % 10 === 0;
      const is5 = x % 5 === 0;
      const is1 = !is5 && !is10;

      if (is1 && skip1m) continue;
      if (is5 && !is10 && skip5m) continue;

      const cp = this.worldToCanvas(x, 0);
      ctx.beginPath();
      ctx.moveTo(cp.x, 0);
      ctx.lineTo(cp.x, h);

      if (is10) {
        ctx.strokeStyle = '#4a5070';
        ctx.lineWidth = 1.5;
      } else if (is5) {
        ctx.strokeStyle = '#363a52';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = '#252836';
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = yMin; y <= yMax; y++) {
      const is10 = y % 10 === 0;
      const is5 = y % 5 === 0;
      const is1 = !is5 && !is10;

      if (is1 && skip1m) continue;
      if (is5 && !is10 && skip5m) continue;

      const cp = this.worldToCanvas(0, y);
      ctx.beginPath();
      ctx.moveTo(0, cp.y);
      ctx.lineTo(w, cp.y);

      if (is10) {
        ctx.strokeStyle = '#4a5070';
        ctx.lineWidth = 1.5;
      } else if (is5) {
        ctx.strokeStyle = '#363a52';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = '#252836';
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
    }

    // Axis labels every 10m
    const fontSize = Math.max(10, Math.min(13, this.scale * 0.9));
    ctx.font = `${fontSize}px monospace`;
    ctx.fillStyle = '#8b90a0';

    for (let x = 0; x <= this.worldSize; x += 10) {
      const cp = this.worldToCanvas(x, 0);
      if (cp.x < 0 || cp.x > w) continue;
      const labelY = Math.min(h - fontSize - 2, Math.max(2, cp.y + 3));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(x), cp.x, labelY);
    }

    for (let y = 0; y <= this.worldSize; y += 10) {
      const cp = this.worldToCanvas(0, y);
      if (cp.y < 0 || cp.y > h) continue;
      const labelX = Math.max(2, cp.x + 3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(y), labelX, cp.y);
    }

    ctx.restore();
  }

  _drawTarget(ctx, target) {
    const cp = this.worldToCanvas(target.x, target.y);
    const r = Math.max(8, this.scale * 0.6);

    ctx.save();
    ctx.strokeStyle = '#00d4aa';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 212, 170, 0.15)';

    ctx.beginPath();
    ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cp.x - r * 1.6, cp.y);
    ctx.lineTo(cp.x + r * 1.6, cp.y);
    ctx.moveTo(cp.x, cp.y - r * 1.6);
    ctx.lineTo(cp.x, cp.y + r * 1.6);
    ctx.stroke();

    ctx.fillStyle = '#00d4aa';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('B', cp.x + r + 4, cp.y - 3);

    ctx.restore();
  }

  _drawAGV(ctx, agv) {
    const x = agv ? agv.x : 25;
    const y = agv ? agv.y : 25;
    const theta = agv ? agv.theta : 0;

    const cp = this.worldToCanvas(x, y);
    const s = this.scale; // 1m in canvas pixels

    ctx.save();
    ctx.translate(cp.x, cp.y);
    ctx.rotate(-theta); // canvas Y is inverted

    // Blue 1m×1m body
    ctx.fillStyle = '#2255cc';
    ctx.strokeStyle = '#6699ff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);

    // White direction arrow pointing forward (+X in world)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(s * 0.38, 0);
    ctx.lineTo(-s * 0.12, -s * 0.20);
    ctx.lineTo(-s * 0.12, s * 0.20);
    ctx.closePath();
    ctx.fill();

    // Yellow center dot
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, s * 0.07), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawObstacle(ctx, obs) {
    const cp = this.worldToCanvas(obs.x, obs.y);
    const s = this.scale;

    ctx.save();
    ctx.fillStyle = 'rgba(247, 110, 110, 0.7)';
    ctx.strokeStyle = '#f76e6e';
    ctx.lineWidth = 1;

    if (obs.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(cp.x - s / 2, cp.y - s / 2, s, s);
      ctx.strokeRect(cp.x - s / 2, cp.y - s / 2, s, s);
    }

    ctx.restore();
  }
}
