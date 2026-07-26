import type { IMemories } from "../../models/Memories.ts"
import type { IMessage } from "../../models/Message.ts"
import type { ISession } from "../../models/Session.ts"
import type { MemoryCache, SessionCache } from "../../services/cache.service.ts"

export type DescisionAI = {
    currentMessage: string,
    recentMessages: string[],
    session: SessionCache[],
    memories: MemoryCache[]
}