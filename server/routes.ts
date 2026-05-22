import type { Express } from "express";
import { type Server } from "http";
import { registerApiHub } from "./modules/api-hub";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await registerApiHub(httpServer, app);
  return httpServer;
}
