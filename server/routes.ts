import type { Express } from "express";
import type { Server } from "http";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // prefix all routes with /api
  // e.g. app.get("/api/items", async (_req, res) => { ... })

  return httpServer;
}
