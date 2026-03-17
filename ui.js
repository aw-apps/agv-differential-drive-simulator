(function () {
  const canvas = document.getElementById('sim-canvas');
  const canvasArea = document.getElementById('canvas-area');
  let _obsIdCounter = 0;

  // ── Coordinate display bar ──────────────────────────────────────────────
  const coordBar = document.createElement('div');
  coordBar.id = 'coord-display';
  coordBar.style.cssText = [
    'position:absolute', 'top:0', 'left:0', 'right:0',
    'padding:3px 10px', 'background:rgba(26,29,39,0.88)',
    'color:#8b90a0', 'font-family:monospace', 'font-size:11px',
    'z-index:10', 'pointer-events:none', 'user-select:none',
    'border-bottom:1px solid #2e3147', 'letter-spacing:0.04em'
  ].join(';');
  coordBar.textContent = 'X: —  Y: —';
  canvasArea.appendChild(coordBar);

  function resizeCanvas() {
    canvas.width = canvasArea.clientWidth;
    canvas.height = canvasArea.clientHeight;
    if (window.simMap) {
      window.simMap.resize();
    }
    if (window.simulator) {
      simulator._render();
    }
  }

  window.addEventListener('resize', resizeCanvas);

  // Size canvas before constructing map so _initView sees correct dimensions
  resizeCanvas();

  window.simMap = new SimMap(canvas);
  window.simulator = new Simulator(simMap);

  // Initial render + telemetry
  simulator._render();
  simulator._updateTelemetry();

  // Start is disabled until a target is set
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-start').title = '請先右鍵點擊地圖設定目標 B';

  // Right-click: set target B
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const world = simMap.canvasToWorld(cx, cy);
    simulator.setTarget(world.x, world.y);
    document.getElementById('btn-start').disabled = false;
  });

  // Left-click: place obstacle snapped to 0.5m grid (only when not panning)
  canvas.addEventListener('click', e => {
    if (simMap._dragMoved) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const world = simMap.canvasToWorld(cx, cy);
    // Snap to 0.5m grid
    const snapX = Math.round(world.x * 2) / 2;
    const snapY = Math.round(world.y * 2) / 2;
    const obs = new Obstacle(++_obsIdCounter, window.obstacleShape || 'square', snapX, snapY);
    simulator.addObstacle(obs);
    _addObstacleToList(obs);
  });

  // Hover on canvas triggers re-render so obstacle highlight is responsive in idle state
  // Also update live world-coordinate display
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const world = simMap.canvasToWorld(cx, cy);
    coordBar.textContent = `X: ${world.x.toFixed(2)} m  Y: ${world.y.toFixed(2)} m`;
    if (!simulator.running) simulator._render();
  });

  function _addObstacleToList(obs) {
    const list = document.getElementById('obstacle-list');
    const item = document.createElement('div');
    item.className = 'obstacle-item';
    item.dataset.obsId = obs.id;

    const typeIcon = document.createElement('span');
    typeIcon.className = 'obs-type-icon';
    typeIcon.textContent = obs.type === 'circle' ? '●' : '■';
    typeIcon.title = obs.type === 'circle' ? '圓形' : '正方形';

    const xInput = document.createElement('input');
    xInput.type = 'number';
    xInput.step = '0.5';
    xInput.value = obs.x.toFixed(1);
    xInput.title = 'X (m)';
    xInput.addEventListener('input', () => {
      obs.x = parseFloat(xInput.value) || 0;
      if (!simulator.running) simulator._render();
    });

    const yInput = document.createElement('input');
    yInput.type = 'number';
    yInput.step = '0.5';
    yInput.value = obs.y.toFixed(1);
    yInput.title = 'Y (m)';
    yInput.addEventListener('input', () => {
      obs.y = parseFloat(yInput.value) || 0;
      if (!simulator.running) simulator._render();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      const idx = simulator.obstacles.indexOf(obs);
      if (idx !== -1) simulator.removeObstacle(idx);
      item.remove();
    });

    item.appendChild(typeIcon);
    item.appendChild(xInput);
    item.appendChild(yInput);
    item.appendChild(delBtn);
    list.appendChild(item);
  }

  // Speed multiplier
  const speedSlider = document.getElementById('speed-multiplier');
  const speedLabel = document.getElementById('speed-label');
  speedSlider.addEventListener('input', () => {
    speedLabel.textContent = speedSlider.value + '×';
    simulator.speedMultiplier = parseInt(speedSlider.value, 10);
  });

  // Control buttons
  document.getElementById('btn-start').addEventListener('click', () => {
    simulator.start();
    simMap.paused = false;
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    simulator._updateStatus('running');
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    simulator.pause();
    simMap.paused = true;
    document.getElementById('btn-start').disabled = !simulator.target;
    document.getElementById('btn-pause').disabled = true;
    simulator._render();
    simulator._updateStatus('idle');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    // Preserve obstacles and target; only reset AGV state
    const savedObstacles = simulator.obstacles;
    const savedTarget = simulator.target;
    simulator.reset();
    simulator.obstacles = savedObstacles;
    simulator.target = savedTarget;
    simMap.paused = true;
    simulator._render();
    document.getElementById('btn-start').disabled = !simulator.target;
    document.getElementById('btn-pause').disabled = true;
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (simulator.running) {
        document.getElementById('btn-pause').click();
      } else if (simulator.target && !document.getElementById('btn-start').disabled) {
        document.getElementById('btn-start').click();
      }
    } else if (e.code === 'KeyR') {
      document.getElementById('btn-reset').click();
    } else if (e.code === 'Escape') {
      simulator.target = null;
      simMap.paused = true;
      document.getElementById('btn-start').disabled = true;
      simulator._render();
    }
  });

  // Obstacle shape toggle
  window.obstacleShape = 'square';

  document.getElementById('btn-square').addEventListener('click', () => {
    window.obstacleShape = 'square';
    document.getElementById('btn-square').classList.add('active');
    document.getElementById('btn-circle').classList.remove('active');
  });

  document.getElementById('btn-circle').addEventListener('click', () => {
    window.obstacleShape = 'circle';
    document.getElementById('btn-circle').classList.add('active');
    document.getElementById('btn-square').classList.remove('active');
  });

  // Clear all obstacles
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    simulator.clearObstacles();
    document.getElementById('obstacle-list').innerHTML = '';
  });
})();
