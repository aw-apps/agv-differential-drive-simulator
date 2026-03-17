// AGV physics stub — full implementation in a future issue
class AGV {
  constructor(x, y, theta) {
    this.x = x || 25;
    this.y = y || 25;
    this.theta = theta || 0;
    this.vl = 0; // left wheel speed mm/s
    this.vr = 0; // right wheel speed mm/s
    this.wheelbase = 0.9; // metres
    this.wheelDiameter = 100; // mm
  }
}
