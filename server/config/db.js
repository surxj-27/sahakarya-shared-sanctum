
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (process.env.NODE_ENV === "production" && !process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI must be configured in production.");
    }
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/shared_sanctum";
    await mongoose.connect(mongoUri);

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
