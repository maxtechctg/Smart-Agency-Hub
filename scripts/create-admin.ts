
import { db } from "../server/db";
import { users } from "../shared/schema";
import { hash } from "bcrypt";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    try {
        const password = await hash("password123", 10);
        console.log("Creating admin...");

        // Check if exists
        const existing = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.email, "admin@smartagencyhub.com")
        });

        if (existing) {
            console.log("Admin already exists. Updating password...");
            // Update password just in case
            await db.update(users)
                .set({ password, role: "admin" })
                .where(eq(users.email, "admin@smartagencyhub.com"));
        } else {
            await db.insert(users).values({
                email: "admin@smartagencyhub.com",
                username: "admin",
                password,
                fullName: "Admin User",
                role: "admin"
            });
            console.log("Admin created");
        }
    } catch (e: any) {
        console.log("Error:", e);
    }
    process.exit(0);
}

main();
