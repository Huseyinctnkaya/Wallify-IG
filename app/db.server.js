import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

export const prisma = global.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  // Debug: Log available models to console to verify Client is up to date
  const dmmf = prisma._dmmf;
  if (dmmf && dmmf.modelMap) {
    console.log("✅ Prisma Client Initialized. Available Models:", Object.keys(dmmf.modelMap));
  } else {
    // Fallback check
    console.log("⚠️ Prisma Client Initialized. Checking keys:", Object.keys(prisma));
  }
}


