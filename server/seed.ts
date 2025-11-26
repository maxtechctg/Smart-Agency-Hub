import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

/**
 * Database seeding script to create initial admin account
 * Run with: tsx server/seed.ts
 */

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Check if admin already exists
    const adminEmail = "admin@maxtech.com";
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);

    if (existingAdmin.length > 0) {
      console.log("✅ Admin account already exists:", adminEmail);
      console.log("   You can log in with the existing admin credentials.");
      return;
    }

    // Create initial admin account
    const defaultPassword = "Admin@123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const [admin] = await db.insert(users).values({
      fullName: "System Administrator",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      clientId: null,
    }).returning();

    console.log("\n✅ Initial admin account created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:    ", adminEmail);
    console.log("🔑 Password: ", defaultPassword);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n⚠️  IMPORTANT: Change this password after first login!");
    console.log("   Go to Settings → Change Password\n");
    console.log("🎯 You can now:");
    console.log("   1. Log in with these credentials");
    console.log("   2. Navigate to Team → Add Team Member");
    console.log("   3. Create client user accounts with Role = Client");
    console.log("   4. Assign clients to projects\n");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
