import type { Request, Response } from "express";

let application: Promise<typeof import("../server/index.ts")> | undefined;

// Vercel invokes the API without opening a listening socket. Initialization is
// shared by concurrent requests in a warm instance; failed starts can retry.
export default async function handler(req: Request, res: Response) {
  try {
    application ||= import("../server/index.ts").catch((error) => {
      application = undefined;
      throw error;
    });
    const { app } = await application;
    return app(req, res);
  } catch (error) {
    console.error(
      "English Tech API initialization failed:",
      error instanceof Error ? error.message : "Unknown initialization error",
    );
    res.setHeader("Cache-Control", "no-store");
    res
      .status(503)
      .json({
        error:
          "The website backend is not ready. The site owner needs to finish the database and service configuration.",
      });
  }
}
