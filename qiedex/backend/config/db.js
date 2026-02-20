import mongoose from "mongoose";

export default async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: "qiedex"
  });
  console.log("✅ MongoDB connected");
}
