import type { IGroup } from "../models/Group.js";
import Group from "../models/Group.js";
import Memories, { type IMemories } from "../models/Memories.js";
import Reminder, { type IReminder } from "../models/Reminder.js";
import { ContextBuilder } from "../utils/ContextBuilder.js";
import AgentService from "./agent.service.js";
import type { CacheService, GroupCache } from "./cache.service.js";
import { MessageService, type StorePayload } from "./message.service.js";

const CHECK_INTERVAL = 30 * 1000;
let lastDay = "";

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
                void this.dailyReminderPlannerTick();
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

        const tomorrowStart = new Date();
        tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
        tomorrowStart.setUTCHours(0, 0, 0, 0);

        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 1);

        const plannerReminders = await Reminder.find({
            status: "pending",
            remindAt: { $gte: tomorrowStart, $lt: tomorrowEnd }
        });

        if(plannerReminders && plannerReminders.length > 0) {
            return;
        } else {
            try {
                await this.createTomorrowReminder();
            } catch (error) {
                console.error("Create Daily reminder planner:", error);
            }
        }
    }

    private async process(reminder: IReminder) {
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

    private async dailyReminderPlannerTick() {
        const now = new Date();

        const indiaDate = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
        }).format(now);

        if(indiaDate === lastDay) {
            return;
        }

        const indiaTime = new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "Asia/Kolkata"
        }).format(now);

        if(indiaTime < "00:01") {
            return;
        }

        lastDay = indiaDate;

        await this.createTomorrowReminder();
    }

    private async createTomorrowReminder() {
        console.log("Create Tomorrow Reminder Planner!")
        const groups = await Group.find({}, "_id");
        
        for(const group of groups) {
            const followUpAt = this.randomTomorrowUTC();
            try {
                const builder = await ContextBuilder.build(group._id, "reminder", this.cache)
                const agent = new AgentService(builder);
                let hasRead = false;

                while(true) {
                    const result = await agent.memoryAI("daily_followup", {
                        sender: "system",
                        type: "daily_followup",
                        followUpAt: followUpAt.toISOString()
                    })

                    if (!result?.actions?.length) {
                        break;
                    }

                    const action = result.actions[0];

                    switch (action.action) {
                        case "read":
                            if (hasRead) {
                                throw new Error("MemoryAI requested read twice.");
                            }
                            hasRead = true;
                            const memories = await AgentService.MemoryRetriever(
                                group._id,
                                action.query
                            );
                            this.cache.setMemories(group._id, memories);
                            continue;
                        case "create":
                            await agent.saveMemory(
                                group._id,
                                action,
                                this.cache
                            );
                            break;
                        case "update":
                            await agent.updateMemory(
                                group._id,
                                action,
                                this.cache
                            );
                            break;
                        case "delete":
                            await agent.deleteMemory(
                                group._id,
                                action,
                                this.cache
                            );
                            break;
                        default:
                            break;
                    }
                }
            } catch (error) {
                console.error("Daily reminder planner:", group._id, error);
            }
        }
    }

    randomTomorrowUTC() {
        const now = new Date();

        const ist = new Date(
            now.toLocaleString("en-US", {
                timeZone: "Asia/Kolkata"
            })
        )

        ist.setDate(ist.getDate() + 1);

        // random between 7 AM and 10 PM
        const hour = 7 + Math.floor(Math.random() * 14);
        const minute = Math.floor(Math.random() * 60);

        ist.setHours(hour, minute, 0, 0);

        return new Date(ist.toISOString());
    }
}