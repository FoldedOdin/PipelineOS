import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_secret_do_not_use_in_prod";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin";
const NODE_ENV = process.env.NODE_ENV ?? "development";

router.post("/login", (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { username, password } = body;

  if (username !== "admin" || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, {
    expiresIn: "1d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  res.json({ message: "Logged in successfully" });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

router.get("/me", (req, res) => {
  const cookies = (req.cookies ?? {}) as Record<string, unknown>;
  const token = typeof cookies.token === "string" ? cookies.token : undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: decoded });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export const authRouter = router;
