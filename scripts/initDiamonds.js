// Usage: node scripts/initDiamonds.js
// This script sets diamonds: 0 for all users missing the field in the 'test.users' collection.

const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://ilanvx:huyhucuruckuex123@jumpi.bvrlmrh.mongodb.net/test?retryWrites=true&w=majority&appName=Jumpi";

// Define the User schema inline to ensure it targets the right collection
const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', userSchema, 'users');

async function main() {
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to MongoDB Atlas (test.users)');

  const result = await User.updateMany(
    { diamonds: { $exists: false } },
    { $set: { diamonds: 0 } }
  );
  console.log(`Updated ${result.modifiedCount} users to have diamonds: 0`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(err => {
  console.error('Error initializing diamonds:', err);
  process.exit(1);
}); 