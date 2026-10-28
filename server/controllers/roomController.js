
const Room = require("../models/Room");
const crypto = require("crypto");

const createRoom = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Room name is required",
      });
    }

    const inviteCode = crypto.randomBytes(6).toString("hex");
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
const getMyRooms = async (req, res) => {
  try {
    const userId = req.user.userId;

    const rooms = await Room.find({
      $or: [{ owner: userId }, { members: userId }],
    }).sort({ updatedAt: -1 });

    const visibleRooms = rooms.map((room) => {
      const result = room.toObject();
      if (String(room.owner) !== String(userId)) {
        delete result.inviteCode;
      }
      return result;
    });

    res.status(200).json({
      message: "Rooms fetched successfully",
      rooms: visibleRooms,
    });
  } catch (error) {
    console.error("Get my rooms error:", error);

    res.status(500).json({
      message: "Failed to fetch rooms",
    });
  }
};

const joinRoom = async (req, res) => {
  try {
    const inviteCode = req.body?.inviteCode;
    if (typeof inviteCode !== "string" || !inviteCode.trim()) {
      return res.status(400).json({
        message: "A room invitation code is required.",
      });
    }

    const room = await Room.findOneAndUpdate(
      { inviteCode: inviteCode.trim() },
      { $addToSet: { members: req.user.userId } },
      { new: true }
    ).select("_id name owner members");

    if (!room) {
      return res.status(404).json({
        message: "The invitation is invalid or the room no longer exists.",
      });
    }

    return res.status(200).json({
      message: "Room joined successfully",
      room,
    });
  } catch (error) {
    console.error("Join room error:", error);
    return res.status(500).json({
      message: "Failed to join room",
    });
  }
};

module.exports = { createRoom, getMyRooms, joinRoom };
