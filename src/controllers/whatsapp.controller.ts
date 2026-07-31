import type { Request, Response } from "express";
import MessageService from "../services/message.service.js";
import messageService from "../services/message.service.js";
import { ContextBuilder } from "../utils/ContextBuilder.js";
import AgentService from "../services/agent.service.js";
import { CacheService } from "../services/cache.service.js";
import sessionService from "../services/session.service.js";
import Group from "../models/Group.js";
import { ReminderService } from "../services/reminder.service.js";

const cacheService = new CacheService()

export const webHookController = async (req: Request, res: Response) => {
    const data = await req.body;
    console.log("Webhook hit:", data)
    
    const payload = data.payload || data;
    const groupId = payload.from;

    if(!groupId || !groupId.endsWith("@g.us")) {
        return;
    }
    
    if (!groupId) {
        return res.status(400).json({
            message: "GroupId not found!"
        })
    }

    req.io.emit('message', payload);

    try {
        const message = await MessageService.handleUserMessage(payload, data.me.lid)
        const builder = await ContextBuilder.build(message, cacheService);
        const agent = new AgentService(builder);
        const reminderService = new ReminderService(cacheService, agent, payload, data.me.lid)
        reminderService.start()

            try {
                const memories = await agent.memoryAI()
                if(memories && memories.actions && memories.actions.length > 0) {
                    for(const a of memories.actions) {
                        switch(a.action) {
                            case "create":
                                await agent.saveMemory(message.groupId, a, cacheService)
                                break;
                            case "update":
                                await agent.updateMemory(message.groupId, a, cacheService)
                                break;
                            case "delete":
                                await agent.deleteMemory(message.groupId, a, cacheService)
                                break;
                            case "read":
                                const query = a.query
                                const result = await AgentService.MemoryRetriever(message.groupId, query ? query : message.text)
                                cacheService.setMemories(message.groupId, result)
                                break;
                            default:
                                break;
                        }
                    }
                }
            } catch (error) {
                console.error("Background memory task failed:", error);
            }

        await sessionService.manage(message, agent, cacheService)

        const decisionAIRes = await agent.decisionAI()
        if(decisionAIRes && decisionAIRes.reply) {
            await messageService.startTyping(groupId)
            try {
                const replay = await agent.replyAI("message")
                await messageService.sendReplay(groupId, replay)
                await messageService.storeAIMessage(payload, data.me.lid, replay, cacheService)
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