import type { Express } from "express";
import type { Server } from "http";
import teamMembersRouter from "./routes/team-members";
import projectsRouter from "./routes/projects";
import activitiesRouter from "./routes/activities";
import capacityRouter from "./routes/capacity";
import partsRouter from "./routes/parts";
import inventoryRouter from "./routes/inventory";
import storageLocationsRouter from "./routes/storage-locations";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/api/team-members", teamMembersRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/capacity", capacityRouter);
  app.use("/api/parts", partsRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/storage-locations", storageLocationsRouter);

  return httpServer;
}
