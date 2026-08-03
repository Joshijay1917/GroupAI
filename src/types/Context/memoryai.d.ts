import type { IMemories } from "../../models/Memories.ts"
import type { IReminder } from "../../models/Reminder.ts"
import type { MemoryCache, SessionCache } from "../../services/cache.service.ts"

type MemoryAI = {
    currentMessage: {
        sender: Types.ObjectId,
        text: string,
        createdAt: Date
    },
    recentMessages: {senderId: string, text: string}[],
    relatedMemories: MemoryCache[],
    sessions: SessionCache[]
}

type MemoryAIFollowUp = {
    currentMessage: FollowUp,
    recentMessages: {senderId: string, text: string}[],
    relatedMemories: MemoryCache[],
    sessions: SessionCache[],
    pendingReminders: IReminder[]
}

interface FollowUp {
    sender: string,
    groupId: string,
    type: "daily_followup",
    text?: string
}