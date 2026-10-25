
const Room = require("../models/Room");
const crypto = require("crypto");

const createRoom = async (req, res) => {
  console.log("CREATE ROOM CONTROLLER HIT")
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Room name is required",
      });
    }

    const inviteCode = crypto.randomBytes(6).toString("hex");
console.log("authenticated user", req.user)
console.log("req.user.id",req.user?.id)
    const room = await Room.create({
      name: name.trim(),
     owner: req.user.userId,
members: [req.user.userId],
      inviteCode,
    });

    res.status(201).json({
      message: "Room created successfully",
      room,
    });
  } catch (error) {
    console.error("Create room error:", error);

    res.status(500).json({
      message: "Failed to create room",
    });
  }
};

module.exports = { createRoom };
