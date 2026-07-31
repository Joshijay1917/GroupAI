import type { IGroup } from "../models/Group.js";
import Memories, { type IMemories } from "../models/Memories.js";
import Reminder, { type IReminder } from "../models/Reminder.js";
import { ContextBuilder } from "../utils/ContextBuilder.js";
import AgentService from "./agent.service.js";
import type { CacheService, GroupCache } from "./cache.service.js";
import { MessageService, type StorePayload } from "./message.service.js";

const CHECK_INTERVAL = 30 * 1000;

export class ReminderService {
    private cache: CacheService;
    private messageService: MessageService;
    private timer: NodeJS.Timeout | null = null;
    private running = false;

    constructor(cache: CacheService) {
        this.cache = cache;
        this.messageService = new MessageService(cache)
    }
    
    public start() {
        if (this.timer || this.running) return;

        this.running = true;

        try {
            this.timer = setInterval(() => {
                void this.tick();
            }, CHECK_INTERVAL);
        } catch (error) {
            console.error(error)
        } finally {
            this.running = false
        }
    }

    private async tick() {
        console.log("Reminder service tick!")
        const reminders = await Reminder.find({
            status: "pending",
            remindAt: { $lte: new Date() }
        });
        console.log("Reminder service res:", reminders)

        if(reminders && reminders.length > 0) {
            for(const reminder of reminders) {
                try {
                    await this.process(reminder);
                } catch (err) {
                    console.error(err);
                }
            }
        }
    }

    private async process(reminder: IReminder) {
        // const memory = await Memories.findById(reminder.memoryId).populate<{ "groupId": IGroup }>("groupId")
        const reminderDoc = await reminder.populate<{ "groupId": IGroup, "memoryId": IMemories }>([ { path: "groupId" }, { path: "memoryId" } ])

        if(!reminderDoc.memoryId) {
            reminder.status = "cancelled";
            await reminder.save();
            return;
        }
        
        try {
            const builder = await ContextBuilder.build(reminderDoc.groupId._id, reminderDoc.memoryId.text, this.cache)
            const agent = new AgentService(builder)
            const replay = await agent.replyAI("reminder", reminderDoc)
            await this.messageService.sendReplay(reminderDoc.groupId.whatsappUserId, replay)
            const message = await this.messageService.storeAIMessage(reminderDoc.groupId._id, replay)

            reminder.status = "sent";
            await reminder.save();

            return message
        } catch (error) {
            console.error("Reminder ReplayAI Error:", error)
        }
    }
}