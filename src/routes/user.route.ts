import { Router } from "express";
import { addUser, getAllUsers } from "../controllers/user.controller.js";

const router: Router = Router()

router.route('/').get(getAllUsers)
router.route('/').post(addUser)

export default router