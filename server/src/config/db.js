import mongoose from 'mongoose';

/** Connect to MongoDB. Mandatory from Phase 1 on (DECISIONS.md: the Phase 0
 *  DB-less escape hatch is removed — auth cannot work without a database). */
export async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}
