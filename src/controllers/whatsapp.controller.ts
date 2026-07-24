import type { Request, Response } from "express";
import MessageService from "../services/message.service.js";
import SessionService from "../services/session.service.js";
import agentService from "../services/agent.service.js";

export const webHookController = async (req: Request, res: Response) => {
    const data = await req.body;
    
    const payload = data.payload || data;
    const sender = payload.from;
    
    if (!sender) {
        return res.json({
            statusCode: 400,
            message: "Senderid not found!"
        })
    }

    try {
        const message = await MessageService.store(payload)

        const memories = await agentService.memoryAI(message)
        if(memories && memories.save) {
            await agentService.saveMemories(memories.memories)
        }

        const session = await SessionService.manage(message)

        const decisionAIRes = await agentService.decisionAI(message, session, memories)
        if(decisionAIRes && decisionAIRes.reply) {

        }

        return res.json({
            status: 200,
            message: "Message get successfully!"
        })
    } catch (error: any) {
        console.error(error)
        return res.json({
            status: 500,
            message: error?.message ? error.message : "Something went wrong!"
        })
    }
}