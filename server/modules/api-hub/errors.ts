import type { ErrorRequestHandler } from "express";
import { isHttpError } from "../../shared/errors/http-error";

export const apiHubErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (!isHttpError(err)) {
    console.error("Internal Server Error:", err);
  }

  if (res.headersSent) {
    return next(err);
  }

  return res.status(status).json({ message, code: err.code || "INTERNAL_SERVER_ERROR" });
};
