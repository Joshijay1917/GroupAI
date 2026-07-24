import { Router } from "express";
import { webHookController } from "../controllers/whatsapp.controller.js";

const router: Router = Router()

router.route('/webhook').post(webHookController)

export default router