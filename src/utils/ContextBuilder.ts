import type { Types } from "mongoose"
import type { IMessage } from "../models/Message.js"
import type { ISession } from "../models/Session.js"
import type { IMemories } from "../models/Memories.js"
import type { FollowUp, MemoryAI, MemoryAIFollowUp } from "../types/Context/memoryai.js"
import type { DescisionAI } from "../types/Context/decisionai.js"
import type { ReplayAI, ReplayAIRemider } from "../types/Context/replayai.js"
import { CacheService, type GroupCache, type MemoryCache, type SessionCache } from "../services/cache.service.js"
import Message from "../models/Message.js"
import Session from "../models/Session.js"
import AgentService from "../services/agent.service.js"
import type { SummaryAI } from "../types/Context/summaryai.js"
import type { IUser } from "../models/User.js"
import type { IReminder } from "../models/Reminder.js"
import mongoose from "mongoose"

const MAX_RECENT_MESSAGES = 15;
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
    private currentMessage: CurrentMessage | null = null;
    private cache: GroupCache;

    private constructor(cache: GroupCache) {
        this.cache = cache
    }

    public static async build(groupId: Types.ObjectId, text: string, cacheService: CacheService): Promise<ContextBuilder> {
        const cache = cacheService.getGroup(groupId)
        if(cache.recentMessages.length === 0) {
            const [recentMessages, sessions, memories] = await Promise.all([
                Message.find({ groupId: groupId }).sort({ createdAt: -1 }).limit(MAX_RECENT_MESSAGES).lean().populate<{ senderId: IUser }>("senderId"),
                Session.find({ groupId: groupId }).sort({ createdAt: -1 }).limit(2).lean(),
                AgentService.MemoryRetriever(groupId, text)
            ])

            const cache = cacheService.init(groupId, recentMessages, sessions, memories)

            return new ContextBuilder(cache);
        }
        return new ContextBuilder(cache);
    }

    setCurrentMessage(message: IMessage) {
        this.currentMessage = {
            sender: message._id,
            text: message.text,
            createdAt: message.createdAt
        }
    }

    generateMemoryAI(): MemoryAI;
    generateMemoryAI(followUP: FollowUp): MemoryAIFollowUp;

    generateMemoryAI(followUp?: FollowUp): any {
        if(!this.cache.sessions) {
            throw new Error("MemoryAIContext: Current Message not found!")
        }
        const recentMessagesMapped = this.cache.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text }));
        const memoriesSliced = this.cache.memories.slice(-MAX_MEMORIES);

        if(followUp) {
            const currentMessage = {
                sender: "system",
                type: "daily_followup",
                text: "Plan one useful reminder for tomorrow if appropriate. Ignore if nothing deserves a reminder.",
                remindAt: followUp.followUpAt
            }

            console.log("MemoryAI FollowUp Context:", {
                currentMessage,
                recentMessages: recentMessagesMapped,
                relatedMemories: memoriesSliced,
                sessions: this.cache.sessions
            });

            return {
                currentMessage,
                recentMessages: recentMessagesMapped,
                relatedMemories: memoriesSliced,
                sessions: this.cache.sessions
            };
        }
        if(!this.currentMessage) {
            throw new Error("MemoryAIContext: Current Message not found!")
        }
        console.log("MemoreyAI Context Generation:", {
            currentMessage: this.currentMessage,
            recentMessages: this.cache.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            relatedMemories: this.cache.memories.slice(-MAX_MEMORIES),
            sessions: this.cache.sessions
        })
        return {
            currentMessage: this.currentMessage,
            recentMessages: this.cache.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            relatedMemories: this.cache.memories.slice(-MAX_MEMORIES)
        }
    }

    generateDecisionAI(): DescisionAI {
        if(!this.currentMessage || !this.cache.sessions) {
            throw new Error("DecisionAIContext: Current Message not found!")
        }
        console.log("Decision AI Context:", {
            currentMessage: this.currentMessage.text,
            session: this.cache.sessions,
            recentMessages: this.cache.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            memories: this.cache.memories.slice(-MAX_MEMORIES)
        })
        return {
            currentMessage: this.currentMessage.text,
            session: this.cache.sessions,
            recentMessages: this.cache.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            memories: this.cache.memories.slice(-MAX_MEMORIES)
        }
    }

    generateReplayAI(): ReplayAI;
    generateReplayAI(reminder: IReminder): ReplayAIRemider;

    generateReplayAI(reminder?: IReminder): any {
        if(!this.cache.sessions) {
            throw new Error("ReplayAIContext: Sessions not found!")
        }
        const recentMessagesMapped = this.cache.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text }));
        const memoriesSliced = this.cache.memories.slice(-MAX_MEMORIES);

        const context: any = {
            session: this.cache.sessions,
            recentMessages: recentMessagesMapped,
            memories: memoriesSliced
        };
        if(reminder) {
            context.event = "reminder";
            context.currentTime = new Date().toISOString();
            if (reminder.memoryId instanceof mongoose.Types.ObjectId) {
                context.reminder = {
                    memoryId: reminder.memoryId.toString()
                };
            } else {
                context.reminder = {
                    id: reminder.memoryId._id,
                    text: reminder.memoryId.text,
                    metadata: reminder.memoryId.metadata
                };
            }
            
            return context;
        }

        if(!this.currentMessage) {
            throw new Error("ReplayAIContext: Current Message not found!")
        }
        console.log("Replay AI Context:", {
            currentMessage: this.currentMessage,
            session: this.cache.sessions,
            recentMessages: this.cache.recentMessages.slice(-MAX_RECENT_MESSAGES).map(m => ({ senderId: m.sender.name, text: m.text })),
            memories: this.cache.memories.slice(-MAX_MEMORIES)
        })

        return {
            currentMessage: this.currentMessage,
            session: this.cache.sessions,
            recentMessages: recentMessagesMapped,
            memories: memoriesSliced
        }
    }

    async generateSummaryAI(session: ISession): Promise<SummaryAI> {
        if(!this.currentMessage || !this.cache.sessions) {
            throw new Error("SummaryAIContext: Current Message not found!")
        }
        const messages = await Message.find({
            groupId: session.groupId,
            createdAt: {
                $gte: session.createdAt,
                $lte: session.lastActivityAt
            }
        }).sort({ createdAt: 1 });
        console.log("Summary AI Context:", {
            session,
            messages: messages.map(m => ({
                sender: m.senderId.name,
                text: m.text,
                aiGenerated: m.aiGenerated,
                createdAt: m.createdAt
            }))
        })
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