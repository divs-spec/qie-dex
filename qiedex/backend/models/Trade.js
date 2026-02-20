import mongoose from "mongoose";

const TradeSchema = new mongoose.Schema({
  user: String,
  inputToken: String,
  outputToken: String,
  inputAmount: String,
  outputAmount: String,
  slippage: Number,
  txHash: String,
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Trade", TradeSchema);
