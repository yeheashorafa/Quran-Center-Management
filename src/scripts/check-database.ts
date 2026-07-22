import { prisma } from "@/lib/db/prisma";

async function main() {
  const result = await prisma.$queryRaw<Array<{ database: string; server_time: Date }>>`
    SELECT current_database() AS database, NOW() AS server_time
  `;

  console.log("PostgreSQL connection is ready:", result[0]);
}

main()
  .catch((error) => {
    console.error("PostgreSQL connection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
