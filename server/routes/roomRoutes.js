
const express = require("express");
const router = express.Router();

const {
  createRoom,
  getMyRooms,
  joinRoom,
} = require("../controllers/roomController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.get("/my-rooms", authMiddleware, getMyRooms);
module.exports = router;
