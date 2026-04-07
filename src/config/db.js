const mongoose = require('mongoose');
const { Pinecone } = require("@pinecone-database/pinecone");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

const vectorDB = async () => {
  try {

    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });

    const index = pc.Index("sitebot");
    return index;

  } catch (error) {
    console.error("vector db connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = { connectDB, vectorDB };