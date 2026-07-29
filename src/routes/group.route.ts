import { Router } from "express";
import { getAllGroups } from "../controllers/group.controller.js";

const router: Router = Router()

router.route('/').get(getAllGroups)

export default router