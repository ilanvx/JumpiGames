const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  packageId: { type: Number, required: true },
  packageName: { type: String, required: true },
  packageDescription: { type: String, required: true },
  amountPaid: { type: Number, required: true },
  currency: { type: String, default: 'ILS' },
  coinsAdded: { type: Number, default: 0 },
  diamondsAdded: { type: Number, default: 0 },
  paypalOrderId: { type: String, required: true },
  paypalPaymentId: { type: String },
  paypalCaptureId: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'], 
    default: 'pending' 
  },
  environment: { type: String, enum: ['sandbox', 'production'], default: 'production' },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  errorMessage: { type: String }
});

// Index for efficient queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ paypalOrderId: 1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema); 