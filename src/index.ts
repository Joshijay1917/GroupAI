import app from "./app.js"
import { connectToDatabase } from "./config/database.js"
import { Server } from "socket.io"
import http from "http"
import type { NextFunction, Request, Response } from "express"

const PORT = 3000
const server = http.createServer(app)
export const io = new Server(server, {
    cors: { origin: '*' }
})

connectToDatabase();

io.on('connection', (socket) => {
    console.log("Socket: ", socket.id, " Connected to server!")

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
})

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})