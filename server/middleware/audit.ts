import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { auditLogs } from "@shared/schema";
import { AuthRequest } from "./auth";

export async function auditLog(
  userId: string | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any
) {
  try {
    await db.insert(auditLogs).values({
      userId: userId ?? null,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      details: details ?? null,
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}

export function auditMiddleware(action: string, resourceType: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resourceId = req.params.id || data?.id;
        auditLog(req.userId, action, resourceType, resourceId);
      }
      return originalJson(data);
    };
    next();
  };
}
