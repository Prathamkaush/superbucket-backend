CREATE TABLE `ServiceExtension` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `bookingId` INTEGER NOT NULL,
  `serviceName` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `problemImage1` TEXT NOT NULL,
  `problemImage2` TEXT NOT NULL,
  `solvedImage1` TEXT NOT NULL,
  `solvedImage2` TEXT NOT NULL,
  `durationMinutes` INTEGER NOT NULL,
  `charge` DECIMAL(10, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ServiceExtension_bookingId_key`(`bookingId`),
  INDEX `ServiceExtension_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ServiceExtension`
  ADD CONSTRAINT `ServiceExtension_bookingId_fkey`
  FOREIGN KEY (`bookingId`) REFERENCES `ServiceBooking`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
