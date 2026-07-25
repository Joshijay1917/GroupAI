export type CreateMemory = {
    "action": "create",
    "memory": {
        type: "fact" | "task" | "reminder" | "decision" | "preference",
        text: string,
        metadata?: Record<string, any>,
        confidence: number
    }
}