import type { Request, Response } from "express";
import Group from "../models/Group.js";

export const getAllGroups = async (req: Request, res: Response) => {
    try {
        const groups = await Group.find({}).sort({ createdAt: -1 })
        return res.status(200).json({
            data: groups
        })
    } catch (error) {
        console.error(error)
    }
}