// import { NextFunction, Request, Response } from "express";
// import { errorStatus } from "../errors";
// import {
//   toggleVisibilityOverride,
//   toggleApprovalOverride,
//   toggleReplyingOverride,
//   toggleSubmissionOverride,
//   toggleFlaggingOverride,
//   deleteApprovalOverride,
//   deleteReplyingOverride,
//   deleteSubmissionOverride,
//   deleteVisibilityOverride,
//   deleteFlaggingOverride,
// } from "../domain/overrides";
// import { deleteUser } from "../domain/users";
// import {
//   toggleUserLocked,
//   toggleUserPosting,
//   userInformation,
// } from "../domain/enforcements";

// export const router = require("express").Router();
// //#region OVERRIDES
// router.get(
//   "/overrides",
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   },
// );

// router
//   .route("/overrides/submission")
//   .patch(async (req: Request, res: Response) => {
//     try {
//       const override = await toggleSubmissionOverride(req.ctx);
//       return res.status(200).send(override);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   })
//   .delete(async (req: Request, res: Response) => {
//     try {
//       await deleteSubmissionOverride(req.ctx);
//       return res.sendStatus(200);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   });

// router
//   .route("/overrides/approval")
//   .patch(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const override = await toggleApprovalOverride(req.ctx);
//       return res.status(201).send(override);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   })
//   .delete(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await deleteApprovalOverride(req.ctx);
//       return res.sendStatus(204);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   });
// router
//   .router("/overrides/replying")
//   .patch(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const override = await toggleReplyingOverride(req.ctx);
//       return res.status(201).send(override);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   })
//   .delete(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await deleteReplyingOverride(req.ctx);
//       return res.sendStatus(204);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   });
// router
//   .route("/overrides/visible")
//   .patch(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const override = await toggleVisibilityOverride(req.ctx);
//       return res.status(201).send(override);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   })
//   .delete(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await deleteVisibilityOverride(req.ctx);
//       return res.sendStatus(204);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   });
// router
//   .route("/overrides/flagging")
//   .patch(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const override = await toggleFlaggingOverride(req.ctx);
//       return res.status(201).send(override);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   })
//   .delete(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await deleteFlaggingOverride(req.ctx);
//       return res.sendStatus(204);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   });

// //#endregion

// //#region INSTANCES
// //#endregion
// //#region USERS
// router
//   .route("/:user")
//   //   .all(async(req:Request,res:Response,next:NextFunction)=>{next()})
//   .get(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       // /@ts-expect-error
//       const uI = await userInformation(req.params.user as string);
//       return res.status(200).send(uI);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   });
// // .delete(async (req: Request, res: Response, next: NextFunction) => {
// //   try {
// //     await deleteUser(req.ctx,req.params.user);
// //     return res.sendStatus(204)
// //   } catch (e) {
// //     return res.sendStatus(errorStatus(e, true));
// //   }
// // });
// router.patch(
//   "/:user/lock",
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await toggleUserLocked(req.ctx, req.params.user as string);
//       return res.sendStatus(200);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   },
// );
// router.patch(
//   "/:user/posting",
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await toggleUserPosting(req.ctx, req.params.user as string);
//       return res.sendStatus(200);
//     } catch (e) {
//       return res.sendStatus(errorStatus(e, true));
//     }
//   },
// );
// //#endregion
