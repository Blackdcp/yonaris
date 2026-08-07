import { createAuth } from "@workspace/lib/auth/server";
import { db } from "@workspace/lib/db/db";
import { brands, member, user } from "@workspace/lib/db/schema";
import { and, eq } from "drizzle-orm";

type Options = {
	email: string;
	name: string;
	brandId: string;
	apply: boolean;
};

function parseOptions(argv: string[]): Options {
	const values = new Map<string, string>();
	let apply = false;
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		if (arg === "--apply") {
			apply = true;
			continue;
		}
		if (!arg?.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
		const value = argv[index + 1];
		if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
		values.set(arg, value);
		index++;
	}

	const email = values.get("--email")?.trim().toLowerCase();
	const name = values.get("--name")?.trim();
	const brandId = values.get("--brand-id")?.trim();
	if (!email?.includes("@")) throw new Error("--email must be a valid email address");
	if (!name) throw new Error("--name is required");
	if (!brandId) throw new Error("--brand-id is required");
	return { email, name, brandId, apply };
}

async function readPasswordFromStdin(): Promise<string> {
	let input = "";
	process.stdin.setEncoding("utf8");
	for await (const chunk of process.stdin) input += chunk;
	return input.replace(/\r?\n$/, "");
}

async function main() {
	if (process.env.DEPLOYMENT_MODE !== "local") {
		throw new Error("Client viewer provisioning is restricted to DEPLOYMENT_MODE=local");
	}

	const options = parseOptions(process.argv.slice(2));
	const [brand] = await db
		.select({ id: brands.id, name: brands.name, organizationId: brands.organizationId })
		.from(brands)
		.where(eq(brands.id, options.brandId))
		.limit(1);
	if (!brand) throw new Error(`Brand not found: ${options.brandId}`);

	const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, options.email)).limit(1);
	if (existingUser) throw new Error(`User already exists: ${options.email}`);

	if (!options.apply) {
		console.log(
			JSON.stringify({
				status: "dry-run",
				email: options.email,
				name: options.name,
				brandId: brand.id,
				brandName: brand.name,
				organizationId: brand.organizationId,
				organizationRole: "viewer",
			}),
		);
		return;
	}

	const password = await readPasswordFromStdin();
	if (password.length < 12 || password.length > 128) {
		throw new Error("Password supplied on stdin must be between 12 and 128 characters");
	}

	const auth = createAuth();
	let createdUserId: string | null = null;
	try {
		const created = await auth.api.createUser({
			body: {
				email: options.email,
				password,
				name: options.name,
				role: "user",
				data: { emailVerified: true, hasReportGeneratorAccess: false },
			},
		});
		createdUserId = created.user.id;

		await auth.api.addMember({
			body: {
				userId: createdUserId,
				organizationId: brand.organizationId,
				// The organization plugin accepts application-defined role strings
				// at runtime; its default TypeScript union only lists built-in roles.
				role: "viewer" as "member",
			},
		});

		const [membership] = await db
			.select({ role: member.role })
			.from(member)
			.where(and(eq(member.userId, createdUserId), eq(member.organizationId, brand.organizationId)))
			.limit(1);
		if (membership?.role !== "viewer") throw new Error("Viewer membership verification failed");

		console.log(
			JSON.stringify({
				status: "created",
				userId: createdUserId,
				email: options.email,
				brandId: brand.id,
				organizationId: brand.organizationId,
				organizationRole: membership.role,
			}),
		);
	} catch (error) {
		if (createdUserId) {
			await db.delete(user).where(and(eq(user.id, createdUserId), eq(user.email, options.email)));
		}
		throw error;
	}
}

main().then(
	() => process.exit(0),
	(error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	},
);
