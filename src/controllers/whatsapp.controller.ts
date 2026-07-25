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

        void (async () => {
            try {
                const memories = await agentService.memoryAI(message)
                if(memories && memories.save) {
                    await agentService.saveMemories(message.groupId, memories.memories)
                }
            } catch (error) {
                console.error("Background memory task failed:", error);
            }
        })();

        const sessionTask = SessionService.manage(message);
        const memoriesTask = agentService.MemoryRetriever(message);

        const [session, memories] = await Promise.all([
            sessionTask,
            memoriesTask
        ]);

        const decisionAIRes = await agentService.decisionAI(message, session, memories)
        if(decisionAIRes && decisionAIRes.reply) {
            await messageService.startTyping(groupId)
            try {
                const replay = await agentService.replyAI(message, session, memories)
                await messageService.sendReplay(groupId, replay)
                await messageService.storeAIMessage(payload, data.me.lid, replay)
            } finally {
                await messageService.stopTyping(groupId)
            }
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