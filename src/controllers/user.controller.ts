import type { Request, Response } from "express";
import User from "../models/User.js";

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 })
        
        return res.status(200).json({
            data: users
        })
    } catch (error) {
        console.error(error)
    }
}

export const addUser = async (req: Request, res: Response) => {
    try {
        
    } catch (error) {
        
    }
}