import { PrismaClient } from "@prisma/client";

// In development the module graph is re-evaluated on every HMR pass, so a plain
// module-level client would leak a new connection pool each time. Stash it on
// globalThis instead. Production loads this module once, so a bare client is fine.
if (process.env.NODE_ENV !== "production" && !global.prismaGlobal) {
  global.prismaGlobal = new PrismaClient();
}

export const prisma = global.prismaGlobal ?? new PrismaClient();
export default prisma;
