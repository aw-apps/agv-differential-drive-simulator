class AGV {
  constructor(x, y, theta) {
    this.WHEELBASE = 0.9;       // metres
    this.WHEEL_RADIUS = 0.03;   // metres (30mm)
    this.MAX_WHEEL_SPEED = 0.942; // m/s (~3000 RPM)

    this.x = x !== undefined ? x : 25;
    this.y = y !== undefined ? y : 25;
    this.theta = theta !== undefined ? theta : 0;
    this.vL = 0; // left wheel speed m/s
    this.vR = 0; // right wheel speed m/s
  }

  update(dt) {
    const v = (this.vR + this.vL) / 2;
    const omega = (this.vR - this.vL) / this.WHEELBASE;
    this.x += v * Math.cos(this.theta) * dt;
    this.y += v * Math.sin(this.theta) * dt;
    this.theta += omega * dt;
  }

  getRPM() {
    const toRPM = (speed) => (speed / (2 * Math.PI * this.WHEEL_RADIUS)) * 60;
    return {
      left: toRPM(this.vL),
      right: toRPM(this.vR)
    };
  }

  getTelemetry() {
    const v = (this.vR + this.vL) / 2;
    const omega = (this.vR - this.vL) / this.WHEELBASE;
    const rpm = this.getRPM();
    return {
      x: this.x,
      y: this.y,
      v: v * 1000, // convert to mm/s
      omega,
      lRPM: rpm.left,
      rRPM: rpm.right,
      deltaRPM: rpm.right - rpm.left
    };
  }

  reset() {
    this.x = 25;
    this.y = 25;
    this.theta = 0;
    this.vL = 0;
    this.vR = 0;
  }
}
