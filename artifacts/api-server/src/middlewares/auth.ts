import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export class OwnerAccessError extends Error {
  constructor() {
    super("Questo account non è autorizzato a usare il terminale.");
    this.name = "OwnerAccessError";
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }
  req.userId = userId;
  next();
}

/**
 * This app intentionally has one owner. The first authenticated user claims the
 * empty platform row; every later account is rejected without exposing data.
 */
export async function requireSingleOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  try {
    const owner = await pool.query<{ owner_user_id: string }>(
      "SELECT owner_user_id FROM platform_settings ORDER BY created_at ASC LIMIT 1",
    );
    if (owner.rowCount === 0) {
      await pool.query(
        `INSERT INTO platform_settings (owner_user_id)
         VALUES ($1)
         ON CONFLICT (owner_user_id) DO NOTHING`,
        [userId],
      );
    }

    const current = await pool.query<{ owner_user_id: string }>(
      "SELECT owner_user_id FROM platform_settings ORDER BY created_at ASC LIMIT 1",
    );
    if (current.rows[0]?.owner_user_id !== userId) {
      throw new OwnerAccessError();
    }
    next();
  } catch (error) {
    if (error instanceof OwnerAccessError) {
      res.status(403).json({ error: error.message });
      return;
    }
    next(error);
  }
}