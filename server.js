const config = require("config")

const express = require("express")
const app = express()
const http = require("http")
const server = http.createServer(app)
const { Server } = require("socket.io")
const io = new Server(server)

const PORT = config.get("port")

const rooms = new Map()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get("/rooms/:id", (req, res) => {
    const roomId = req.params.id

    const data = rooms.has(roomId)
        ? {
              users: [...rooms.get(roomId).get("users").values()],
              messages: [...rooms.get(roomId).get("messages").values()],
          }
        : { users: [], messages: [] }

    res.json(data)
})

app.post("/rooms", (req, res) => {
    const { roomId, userName } = req.body

    if (!rooms.has(roomId)) {
        rooms.set(
            roomId,
            new Map([
                ["users", new Map()],
                ["messages", []],
            ])
        )

        res.status(200).json({ message: "Created and joined to room  #" + roomId })
    } else if (Array.from(rooms.get(roomId).get("users").values()).includes(userName)) {
        return res.status(403).json({ message: "This username already exists" })
    } else {
        res.status(200).json({ message: "Joined to room #" + roomId })
    }
})

io.on("connection", (socket) => {
    socket.on("ROOM_JOIN", ({ roomId, userName }) => {
        socket.join(roomId)

        rooms.get(roomId).get("users").set(socket.id, userName)

        const users = [...rooms.get(roomId).get("users").values()]
        const messages = [...rooms.get(roomId).get("messages").values()]

        io.to(roomId).emit("ROOM_SET_ALL_DATA", { users, messages })
    })

    socket.on("ROOM_NEW_MSG", ({ roomId, userName, text }) => {
        // socket.join(roomId)
        const date = new Date()
        const dateString = date.getHours() + ":" + ("00" + date.getMinutes()).slice(-2)
        const newMsg = { userName, text, time: dateString }

        rooms.get(roomId).get("messages").push(newMsg)

        io.to(roomId).emit("ROOM_ADD_MSG", newMsg)
        //socket.broadcast.to(roomId).emit("ROOM_ADD_MSG", newMsg)
    })

    socket.on("disconnect", () => {
        rooms.forEach((value, roomId) => {
            if (value.get("users").delete(socket.id)) {
                const users = [...value.get("users").values()]

                socket.broadcast.to(roomId).emit("ROOM_SET_USERS", users)
            }
        })
    })
    //socket.on("test", (data) => console.log(data))

    console.log("a user connected: ", socket.id)
})

server.listen(PORT, () => console.log(`server started at PORT: ${PORT}`))
