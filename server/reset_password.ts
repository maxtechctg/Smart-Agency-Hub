
import "dotenv/config";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: npx tsx server/reset_password.ts <email> <new_password>");
        process.exit(1);
    }

    const [email, newPassword] = args;

    console.log(`Resetting password for user: ${email}`);

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
        console.error(`User not found: ${email}`);
        process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));

    console.log(`Password updated successfully for ${email}`);
    process.exit(0);
}

main().catch(console.error);
