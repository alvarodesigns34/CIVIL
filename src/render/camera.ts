export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  vw = 800;
  vh = 600;
  minZoom = 0.25;
  maxZoom = 2.6;
  // animación hacia un objetivo
  target: { x: number; y: number; zoom: number; t: number } | null = null;
  worldW = 1000;
  worldH = 1000;

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.vw / 2) / this.zoom + this.x, (sy - this.vh / 2) / this.zoom + this.y];
  }
  toScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.vw / 2, (wy - this.y) * this.zoom + this.vh / 2];
  }
  pan(dx: number, dy: number) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.target = null;
    this.clamp();
  }
  zoomAt(sx: number, sy: number, factor: number) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const [nx, ny] = this.toWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
    this.target = null;
    this.clamp();
  }
  flyTo(x: number, y: number, zoom = this.zoom) {
    this.target = { x, y, zoom, t: 0 };
  }
  update(dt: number) {
    if (!this.target) return;
    const k = 1 - Math.pow(0.0015, dt);
    this.x += (this.target.x - this.x) * k;
    this.y += (this.target.y - this.y) * k;
    this.zoom += (this.target.zoom - this.zoom) * k;
    if (Math.abs(this.target.x - this.x) < 0.5 && Math.abs(this.target.y - this.y) < 0.5 && Math.abs(this.target.zoom - this.zoom) < 0.002) this.target = null;
    this.clamp();
  }
  clamp() {
    const mx = this.vw / 2 / this.zoom, my = this.vh / 2 / this.zoom;
    this.x = Math.max(Math.min(mx * 0.3, this.worldW / 2), Math.min(this.x, Math.max(this.worldW - mx * 0.3, this.worldW / 2)));
    this.y = Math.max(Math.min(my * 0.3, this.worldH / 2), Math.min(this.y, Math.max(this.worldH - my * 0.3, this.worldH / 2)));
  }
}
