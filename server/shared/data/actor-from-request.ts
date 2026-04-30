import type { Request } from "express";
import type { ActorContext, MetadataSource } from "./write-metadata";
import { HttpError } from "../errors/http-error";

export const actorFromRequest = (req: Request, source?: MetadataSource): ActorContext => {
  const session = req.workbenchSession;
  if (!session) {
    throw new HttpError(401, "Cannot derive actor from anonymous request", "NO_SESSION");
  }
  return {
    userId: session.userId,
    role: session.activeRole,
    facilityKey: session.activeFacility,
    source: source ?? "manual",
  };
};
