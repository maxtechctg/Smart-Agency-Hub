
import "dotenv/config";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function main() {
    const args = process.argv.slice(2);
    const email = args[0] || "admin_new@agency.com";
    const password = args[1] || "Admin@123";
    const name = args[2] || "New Administrator";

    console.log(`Creating new admin account...`);
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existingUser.length > 0) {
        console.error(`Error: User with email ${email} already exists.`);
        process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin
    const [user] = await db.insert(users).values({
        fullName: name,
        email: email,
        password: hashedPassword,
        role: "admin",
        clientId: null,
    }).returning();

    console.log("\n✅ Admin account created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:    ", email);
    console.log("🔑 Password: ", password);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    process.exit(0);
}

main().catch(console.error);
