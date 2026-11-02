import "server-only";

import { prisma } from "@/db/client";

/**
 * Better Auth хранит ссылку как `Verification.identifier = reset-password:<token>`
 * и `value` = id пользователя. `consumeVerificationValue` удаляет только строки
 * с тем же identifier. После успешного сброса гасим остальные ссылки этого
 * пользователя (FR-3). Записи с другим префиксом и чужие токены не трогаем.
 */
export async function invalidateOutstandingPasswordResets(userId: string): Promise<void> {
  await prisma.verification.deleteMany({
    where: {
      value: userId,
      identifier: { startsWith: "reset-password:" },
    },
  });
}
