(function () {
  const canvas = document.getElementById('sim-canvas');
  const canvasArea = document.getElementById('canvas-area');

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

  // Right-click: set target
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const world = simMap.canvasToWorld(cx, cy);
    console.log('Target set:', world);
    simulator.setTarget(world.x, world.y);
  });

  // Left-click: place obstacle (only when not panning)
  canvas.addEventListener('click', e => {
    if (simMap._dragMoved) return; // suppress click after pan
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const world = simMap.canvasToWorld(cx, cy);
    const obs = { x: world.x, y: world.y, shape: window.obstacleShape || 'square' };
    simulator.addObstacle(obs);
    _addObstacleToList(obs, simulator.obstacles.length - 1);
  });

  function _addObstacleToList(obs, index) {
    const list = document.getElementById('obstacle-list');
    const item = document.createElement('div');
    item.className = 'obstacle-item';
    item.dataset.index = index;

    const xInput = document.createElement('input');
    xInput.type = 'number';
    xInput.step = '0.1';
    xInput.value = obs.x.toFixed(1);
    xInput.title = 'X (m)';
    xInput.addEventListener('change', () => {
      obs.x = parseFloat(xInput.value) || 0;
      if (!simulator.running) simulator._render();
    });

    const yInput = document.createElement('input');
    yInput.type = 'number';
    yInput.step = '0.1';
    yInput.value = obs.y.toFixed(1);
    yInput.title = 'Y (m)';
    yInput.addEventListener('change', () => {
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
    if (!simulator.target) {
      alert('Right-click on the map to set a target first.');
      return;
    }
    simulator.start();
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    simulator._updateStatus('running');
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    simulator.pause();
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-pause').disabled = true;
    simulator._updateStatus('idle');
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    simulator.reset();
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-pause').disabled = true;
    document.getElementById('obstacle-list').innerHTML = '';
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
