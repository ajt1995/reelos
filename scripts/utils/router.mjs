export class Router {
  constructor() {
    this.routes = [];
  }

  get(path, handler) { this.routes.push({ method: "GET", path, handler, exact: true }); }
  post(path, handler) { this.routes.push({ method: "POST", path, handler, exact: true }); }
  all(path, handler) { this.routes.push({ method: "ALL", path, handler, exact: true }); }
  prefix(path, handler) { this.routes.push({ method: "ALL", path, handler, exact: false }); }

  async dispatch(req, res) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathOnly = url.pathname;
    const method = (req.method || "GET").toUpperCase();

    for (const route of this.routes) {
      if (route.method !== "ALL" && route.method !== method) continue;
      
      const match = route.exact ? pathOnly === route.path : pathOnly.startsWith(route.path);
      if (match) {
        const handled = await route.handler(req, res, url);
        if (handled !== false) return true;
      }
    }
    return false;
  }
}

export const apiRouter = new Router();
