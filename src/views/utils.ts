import { Request, Response } from "express";
import { config } from "../config";

export const renderWithLayout = (
  req: Request,
  res: Response,
  view: string,
  locals: Record<string, unknown>,
) => {
  req.app.render(view, { ...locals, ctx: req.ctx }, (err, innerHtml) => {
    if (err) {
      return res.sendStatus(500);
    }

    res.render("layout", {
      title: locals.title ?? "Skybook - Your fully open source guestbook",
      body: innerHtml,
      ctx: req.ctx,
      skybook: config.skybook,
      canonical:
        locals.canonical ?? `${req.protocol}://${req.hostname}${req.path}`,
      protocol: req.protocol,
    });
  });
};
