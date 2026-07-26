import type { IMemories } from "../../models/Memories.ts"
import type { MemoryCache } from "../../services/cache.service.ts"

type MemoryAI = {
    currentMessage: {
        sender: Types.ObjectId,
        text: string,
        createdAt: Date
    },
    recentMessages: String[],
    relatedMemories: MemoryCache[]
}