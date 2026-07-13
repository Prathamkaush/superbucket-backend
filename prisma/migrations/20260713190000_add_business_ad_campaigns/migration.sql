CREATE TABLE `BusinessAdPlan` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `durationDays` INTEGER NOT NULL,
  `description` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `BusinessAdPlan_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BusinessAd` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `planId` INTEGER NOT NULL,
  `status` ENUM('PENDING_REVIEW', 'APPROVED_AWAITING_PAYMENT', 'ACTIVE', 'REJECTED', 'PAUSED', 'EXPIRED', 'ARCHIVED') NOT NULL DEFAULT 'PENDING_REVIEW',
  `businessName` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NULL,
  `description` TEXT NOT NULL,
  `address` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `offerText` VARCHAR(191) NULL,
  `imageUrl` TEXT NULL,
  `priceSnapshot` DECIMAL(10, 2) NOT NULL,
  `durationDaysSnapshot` INTEGER NOT NULL,
  `rejectionReason` TEXT NULL,
  `approvedAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `startsAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `paymentMethod` VARCHAR(191) NULL,
  `paymentId` VARCHAR(191) NULL,
  `razorpayOrderId` VARCHAR(191) NULL,
  `views` INTEGER NOT NULL DEFAULT 0,
  `clicks` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `BusinessAd_paymentId_key`(`paymentId`),
  UNIQUE INDEX `BusinessAd_razorpayOrderId_key`(`razorpayOrderId`),
  INDEX `BusinessAd_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `BusinessAd_status_startsAt_expiresAt_idx`(`status`, `startsAt`, `expiresAt`),
  INDEX `BusinessAd_planId_idx`(`planId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BusinessAd`
  ADD CONSTRAINT `BusinessAd_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BusinessAd_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `BusinessAdPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `BusinessAdPlan` (`name`, `price`, `durationDays`, `description`, `isActive`, `sortOrder`, `updatedAt`) VALUES
  ('Starter', 100.00, 10, 'Homepage sponsored placement for 10 days', true, 0, CURRENT_TIMESTAMP(3)),
  ('Growth', 250.00, 30, 'Homepage sponsored placement for 30 days', true, 1, CURRENT_TIMESTAMP(3));
