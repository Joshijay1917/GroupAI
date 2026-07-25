import mongoose from "mongoose"

const MONGO_URI = process.env.MONGO_URI
if(!MONGO_URI) {
    throw new Error("Database URL not found!")
}

export const connectToDatabase = async () => {
    try {
        const connectionInterface = await mongoose.connect(MONGO_URI)
        console.log("Connected to database! host:", connectionInterface.connection.host)
    } catch (error) {
        console.error(error)
        process.exit(1)
    }
}