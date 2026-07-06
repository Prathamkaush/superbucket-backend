CREATE TABLE `PushDeviceToken` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `platform` ENUM('ANDROID', 'IOS', 'WEB') NOT NULL DEFAULT 'ANDROID',
  `app` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PushDeviceToken_token_key`(`token`),
  INDEX `PushDeviceToken_userId_idx`(`userId`),
  INDEX `PushDeviceToken_isActive_idx`(`isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Notification` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NULL,
  `audience` ENUM('ALL', 'USERS', 'DELIVERY_PARTNERS', 'PROPERTY_OWNERS') NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `imageUrl` VARCHAR(191) NULL,
  `data` JSON NULL,
  `readAt` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `Notification_audience_createdAt_idx`(`audience`, `createdAt`),
  INDEX `Notification_readAt_idx`(`readAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WalletAccount` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `WalletAccount_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WalletTransaction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `walletId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `type` ENUM('CREDIT', 'DEBIT') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `WalletTransaction_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `WalletTransaction_walletId_idx`(`walletId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PushDeviceToken`
  ADD CONSTRAINT `PushDeviceToken_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Notification`
  ADD CONSTRAINT `Notification_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Notification`
  ADD CONSTRAINT `Notification_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `WalletAccount`
  ADD CONSTRAINT `WalletAccount_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WalletTransaction`
  ADD CONSTRAINT `WalletTransaction_walletId_fkey`
  FOREIGN KEY (`walletId`) REFERENCES `WalletAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `WalletTransaction`
  ADD CONSTRAINT `WalletTransaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
