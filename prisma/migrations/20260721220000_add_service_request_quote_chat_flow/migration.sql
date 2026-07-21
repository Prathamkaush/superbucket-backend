ALTER TABLE `ServiceBooking`
  MODIFY COLUMN `status` ENUM(
    'PENDING', 'ACCEPTED', 'QUOTED', 'NEGOTIATING', 'CONFIRMED',
    'EN_ROUTE', 'IN_PROGRESS', 'REVISIT_REQUESTED', 'COMPLETED',
    'PAID', 'CANCELLED', 'REJECTED'
  ) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `issueImages` JSON NULL,
  ADD COLUMN `quoteAmount` DECIMAL(10,2) NULL,
  ADD COLUMN `quoteNote` TEXT NULL,
  ADD COLUMN `quotedDurationMinutes` INT NULL,
  ADD COLUMN `quoteSentAt` DATETIME(3) NULL,
  ADD COLUMN `quoteAcceptedAt` DATETIME(3) NULL,
  ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
  ADD COLUMN `paidAt` DATETIME(3) NULL,
  ADD COLUMN `beforeImages` JSON NULL,
  ADD COLUMN `afterImages` JSON NULL;

CREATE TABLE `ServiceMessage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bookingId` INT NOT NULL,
  `senderId` INT NOT NULL,
  `body` TEXT NOT NULL,
  `imageUrl` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ServiceMessage_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  INDEX `ServiceMessage_senderId_idx` (`senderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ServiceMessage_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `ServiceBooking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ServiceMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceRequestDecline` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bookingId` INT NOT NULL,
  `providerId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ServiceRequestDecline_bookingId_providerId_key` (`bookingId`, `providerId`),
  INDEX `ServiceRequestDecline_providerId_createdAt_idx` (`providerId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ServiceRequestDecline_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `ServiceBooking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ServiceRequestDecline_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
