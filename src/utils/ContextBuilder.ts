import type { Types } from "mongoose"
import type { IMessage } from "../models/Message.js"
import type { ISession } from "../models/Session.js"
import type { IMemories } from "../models/Memories.js"
import type { MemoryAI } from "../types/Context/memoryai.js"
import type { DescisionAI } from "../types/Context/decisionai.js"
import type { ReplayAI } from "../types/Context/replayai.js"
import { CacheService, type GroupCache, type MemoryCache, type SessionCache } from "../services/cache.service.js"
import Message from "../models/Message.js"
import Session from "../models/Session.js"
import AgentService from "../services/agent.service.js"
import type { SummaryAI } from "../types/Context/summaryai.js"
import type { IUser } from "../models/User.js"

const MAX_RECENT_MESSAGES = 50;
const MAX_MEMORIES = 10;

export interface IContextBuilder {
    currentMessage: {
        sender: Types.ObjectId,
        text: string,
        createdAt: Date
    },
    recentMessages: IMessage[],
    session: ISession,
    memories: IMemories[]
}

interface CurrentMessage {
    sender: Types.ObjectId,
    text: string,
    createdAt: Date
}

interface RecentMessage {
    sender: IUser;
    text: string;
    createdAt: Date;
    aiGenerated: boolean;
}

export class ContextBuilder {
    private currentMessage: CurrentMessage;
    private recentMessages: RecentMessage[];
    private sessions: SessionCache[];
    private memories: MemoryCache[];

    private constructor(message: IMessage, cache: GroupCache) {
        this.currentMessage = {
            sender: message.senderId._id,
            text: message.text,
            createdAt: message.createdAt
        },
        this.recentMessages = cache.recentMessages,
        this.sessions = cache.sessions,
        this.memories = cache.memories
    }

    public static async build(message: IMessage, cacheService: CacheService): Promise<ContextBuilder> {
        const cache = cacheService.getGroup(message.groupId)
        if(cache.recentMessages.length === 0) {
            const [recentMessages, sessions, memories] = await Promise.all([
                Message.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(MAX_RECENT_MESSAGES).lean().populate<{ senderId: IUser }>("senderId"),
                Session.find({ groupId: message.groupId }).sort({ createdAt: -1 }).limit(2).lean(),
                AgentService.MemoryRetriever(message)
            ])

            const cache = cacheService.init(message, recentMessages, sessions, memories)

            return new ContextBuilder(message, cache);
        }
        cacheService.pushRecentMessage(message)
        return new ContextBuilder(message, cache);
    }

    generateMemoryAI(): MemoryAI {
        if(!this.currentMessage) {
            throw new Error("MemoryAIContext: Current Message not found!")
        }
        return {
            currentMessage: this.currentMessage,
            recentMessages: this.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            relatedMemories: this.memories.slice(-MAX_MEMORIES)
        }
    }

    generateDecisionAI(): DescisionAI {
        if(!this.currentMessage || !this.sessions) {
            throw new Error("DecisionAIContext: Current Message not found!")
        }
        return {
            currentMessage: this.currentMessage.text,
            session: this.sessions,
            recentMessages: this.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            memories: this.memories.slice(-MAX_MEMORIES)
        }
    }

    generateReplayAI(): ReplayAI {
        if(!this.currentMessage || !this.sessions) {
            throw new Error("ReplayAIContext: Current Message not found!")
        }
        return {
            currentMessage: this.currentMessage,
            session: this.sessions,
            recentMessages: this.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            memories: this.memories.slice(-MAX_MEMORIES)
        }
    }

    async generateSummaryAI(session: ISession): Promise<SummaryAI> {
        if(!this.currentMessage || !this.sessions) {
            throw new Error("SummaryAIContext: Current Message not found!")
        }
        const messages = await Message.find({
            groupId: session.groupId,
            createdAt: {
                $gte: session.createdAt,
                $lte: session.lastActivityAt
            }
        }).sort({ createdAt: 1 });
        return {
            session,
            messages: messages.map(m => ({
                sender: m.senderId.name,
                text: m.text,
                aiGenerated: m.aiGenerated,
                createdAt: m.createdAt
            }))
        }
    }
}