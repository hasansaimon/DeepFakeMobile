import { Router, type IRouter } from "express";
import healthRouter from "./health";
import facesetsRouter from "./facesets";
import modelsRouter from "./models";
import jobsRouter from "./jobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(facesetsRouter);
router.use(modelsRouter);
router.use(jobsRouter);

export default router;
