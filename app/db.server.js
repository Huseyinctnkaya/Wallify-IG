import { PrismaClient } from "@prisma/client";

// Force new instance creation by changing global variable name
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobalV2) {
    global.prismaGlobalV2 = new PrismaClient();
  }
}

export const prisma = global.prismaGlobalV2 ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  // Debug: Log available models to console to verify Client is up to date
  const dmmf = prisma._dmmf;
  if (dmmf && dmmf.modelMap) {
    console.log("✅ Prisma Client Initialized (V2). Available Models:", Object.keys(dmmf.modelMap));
  } else {
    // Fallback check
    console.log("⚠️ Prisma Client Initialized (V2). Checking keys:", Object.keys(prisma));
  }
}
