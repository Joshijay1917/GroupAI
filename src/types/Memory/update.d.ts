export type UpdateMemory = {
    "action": "update",
    "memoryId": string,
    "changes": {
        "text": string,
        "confidence": number,
        "metadata"?: Record<string, any>,
        "embedding"?: number[]
    }
}