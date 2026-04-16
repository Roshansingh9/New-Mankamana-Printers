import prisma from "../../connect";
import { withCache, invalidateCacheKey } from "../../utils/cache";

const BALANCE_TTL_MS = 10_000; // 10-second TTL — short enough to reflect real changes, long enough to absorb bursts
const balanceCacheKey = (clientId: string) => `wallet:balance:${clientId}`;

// getOrCreateWalletService: Ensures a client has a wallet record; creates one with zero balance if missing
export const getOrCreateWalletService = async (clientId: string) => {
  let wallet = await prisma.walletAccount.findUnique({
    where: { clientId },
  });

  if (!wallet) {
    wallet = await prisma.walletAccount.create({
      data: {
        clientId,
        currency: "NPR",
        availableBalance: 0,
      },
    });
  }

  return wallet;
};

// getBalanceService: Logic to fetch and format a client's current available wallet balance
// Uses L1 (in-process memory) + L2 (Redis) for 10-second TTL.
export const getBalanceService = async (clientId: string) => {
  return withCache<{ clientId: string; currency: string; availableBalance: number }>(
    balanceCacheKey(clientId),
    BALANCE_TTL_MS,
    async () => {
      const wallet = await getOrCreateWalletService(clientId);
      return {
        clientId: wallet.clientId,
        currency: wallet.currency,
        availableBalance: Number(wallet.availableBalance),
      };
    }
  );
};

// invalidateBalanceCache: Call after any wallet mutation (debit/credit/topup) to force a fresh read
export const invalidateBalanceCache = async (clientId: string) => {
  await invalidateCacheKey(balanceCacheKey(clientId));
};
