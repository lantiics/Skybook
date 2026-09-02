import { Request, Response } from "express";

export const renderWithLayout = (
  req: Request,
  res: Response,
  view: string,
  locals: Record<string, unknown>,
) => {
  req.app.render(view, { ...locals, ctx: req.ctx }, (err, innerHtml) => {
    if (err) {
      console.error(err);
      return res.sendStatus(500);
    }
    res.render("layout", {
      title: locals.title ?? "Kaiju",
      body: innerHtml,
      ctx: req.ctx,
    });
  });
};
