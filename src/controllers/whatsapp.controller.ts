import type { Request, Response } from "express";
import MessageService from "../services/message.service.js";
import SessionService from "../services/session.service.js";
import agentService from "../services/agent.service.js";
import messageService from "../services/message.service.js";

export const webHookController = async (req: Request, res: Response) => {
    const data = await req.body;
    console.log("Webhook hit:", data)
    
    const payload = data.payload || data;
    const groupId = payload.from;

    if(!groupId && !groupId.endsWith("@g.us")) {
        return;
    }
    
    if (!groupId) {
        return res.status(400).json({
            message: "GroupId not found!"
        })
    }

    try {
        const message = await MessageService.handleUserMessage(payload, data.me.lid)

        const memories = await agentService.memoryAI(message)
        if(memories && memories.save) {
            await agentService.saveMemories(message.groupId, memories.memories)
        }

        const session = await SessionService.manage(message)

        const decisionAIRes = await agentService.decisionAI(message, session, memories)
        if(decisionAIRes && decisionAIRes.reply) {
            const replay = await agentService.replyAI(message, session, memories)
            await messageService.sendReplay(groupId, replay)
            await messageService.storeAIMessage(payload, data.me.lid, replay)
        }

        return res.status(200).json({
            message: "Message get successfully!"
        })
    } catch (error: any) {
        console.error("Something went wrong! error:", error)
        return res.status(500).json({
            message: error?.message ? error.message : "Something went wrong!"
        })
    }
}