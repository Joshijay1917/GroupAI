import type { ISession } from "../../models/Session.ts"
import type { MemoryCache, SessionCache } from "../../services/cache.service.ts"

export type ReplayAI = {
    currentMessage: {
        sender: Types.ObjectId,
        text: string,
        createdAt: Date
    },
    recentMessages: string[],
    session: SessionCache[],
    memories: MemoryCache[]
}