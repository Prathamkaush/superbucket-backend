-- CreateEnum equivalents for MySQL are defined inline on the provider and booking tables.

CREATE TABLE `ServiceCategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `icon` VARCHAR(191) NULL,
  `image` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ServiceCategory_slug_key`(`slug`),
  INDEX `ServiceCategory_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServicePackage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `categoryId` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `durationMinutes` INTEGER NOT NULL,
  `platformFeePercent` DECIMAL(5,2) NOT NULL DEFAULT 20,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ServicePackage_categoryId_isActive_idx`(`categoryId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceProviderProfile` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `isOnline` BOOLEAN NOT NULL DEFAULT false,
  `experienceYears` INTEGER NOT NULL DEFAULT 0,
  `bio` TEXT NULL,
  `city` VARCHAR(191) NULL,
  `serviceRadiusKm` INTEGER NOT NULL DEFAULT 10,
  `rejectionReason` VARCHAR(191) NULL,
  `approvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ServiceProviderProfile_userId_key`(`userId`),
  INDEX `ServiceProviderProfile_status_isOnline_idx`(`status`, `isOnline`),
  INDEX `ServiceProviderProfile_city_idx`(`city`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProviderService` (
  `providerId` INTEGER NOT NULL,
  `categoryId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ProviderService_categoryId_idx`(`categoryId`),
  PRIMARY KEY (`providerId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceBooking` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `bookingNumber` VARCHAR(191) NOT NULL,
  `customerId` INTEGER NOT NULL,
  `providerId` INTEGER NULL,
  `packageId` INTEGER NOT NULL,
  `status` ENUM('PENDING','ACCEPTED','EN_ROUTE','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `scheduledAt` DATETIME(3) NOT NULL,
  `address` JSON NOT NULL,
  `customerNote` TEXT NULL,
  `cancellationReason` VARCHAR(191) NULL,
  `serviceName` VARCHAR(191) NOT NULL,
  `categoryName` VARCHAR(191) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `platformFee` DECIMAL(10,2) NOT NULL,
  `providerEarning` DECIMAL(10,2) NOT NULL,
  `completionOtp` VARCHAR(191) NOT NULL,
  `acceptedAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `rating` INTEGER NULL,
  `review` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ServiceBooking_bookingNumber_key`(`bookingNumber`),
  INDEX `ServiceBooking_customerId_createdAt_idx`(`customerId`, `createdAt`),
  INDEX `ServiceBooking_providerId_status_idx`(`providerId`, `status`),
  INDEX `ServiceBooking_packageId_status_idx`(`packageId`, `status`),
  INDEX `ServiceBooking_status_scheduledAt_idx`(`status`, `scheduledAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ServicePackage` ADD CONSTRAINT `ServicePackage_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ServiceCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServiceProviderProfile` ADD CONSTRAINT `ServiceProviderProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProviderService` ADD CONSTRAINT `ProviderService_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `ServiceProviderProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProviderService` ADD CONSTRAINT `ProviderService_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ServiceCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServiceBooking` ADD CONSTRAINT `ServiceBooking_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServiceBooking` ADD CONSTRAINT `ServiceBooking_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ServiceBooking` ADD CONSTRAINT `ServiceBooking_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `ServicePackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `ServiceCategory` (`name`, `slug`, `description`, `icon`, `sortOrder`, `updatedAt`) VALUES
('Electrician', 'electrician', 'Electrical repairs and installation at home', 'E', 1, CURRENT_TIMESTAMP(3)),
('Plumbing', 'plumbing', 'Leaks, fittings and plumbing repairs', 'P', 2, CURRENT_TIMESTAMP(3)),
('Home Cleaning', 'home-cleaning', 'Reliable cleaning for your home', 'C', 3, CURRENT_TIMESTAMP(3)),
('Carpentry', 'carpentry', 'Furniture assembly and wood repairs', 'W', 4, CURRENT_TIMESTAMP(3));

INSERT INTO `ServicePackage` (`categoryId`, `name`, `description`, `price`, `durationMinutes`, `platformFeePercent`, `updatedAt`)
SELECT `id`, 'Electrician inspection', 'Inspection and minor repair; parts charged separately', 299, 60, 20, CURRENT_TIMESTAMP(3) FROM `ServiceCategory` WHERE `slug` = 'electrician';
INSERT INTO `ServicePackage` (`categoryId`, `name`, `description`, `price`, `durationMinutes`, `platformFeePercent`, `updatedAt`)
SELECT `id`, 'Fan installation', 'Installation of one ceiling or wall fan', 449, 90, 20, CURRENT_TIMESTAMP(3) FROM `ServiceCategory` WHERE `slug` = 'electrician';
INSERT INTO `ServicePackage` (`categoryId`, `name`, `description`, `price`, `durationMinutes`, `platformFeePercent`, `updatedAt`)
SELECT `id`, 'Plumber inspection', 'Inspection and minor repair; parts charged separately', 299, 60, 20, CURRENT_TIMESTAMP(3) FROM `ServiceCategory` WHERE `slug` = 'plumbing';
INSERT INTO `ServicePackage` (`categoryId`, `name`, `description`, `price`, `durationMinutes`, `platformFeePercent`, `updatedAt`)
SELECT `id`, 'Bathroom cleaning', 'Deep cleaning of one bathroom', 499, 90, 20, CURRENT_TIMESTAMP(3) FROM `ServiceCategory` WHERE `slug` = 'home-cleaning';
INSERT INTO `ServicePackage` (`categoryId`, `name`, `description`, `price`, `durationMinutes`, `platformFeePercent`, `updatedAt`)
SELECT `id`, 'Full home cleaning', 'Deep cleaning for a home up to 2 BHK', 1999, 240, 20, CURRENT_TIMESTAMP(3) FROM `ServiceCategory` WHERE `slug` = 'home-cleaning';
INSERT INTO `ServicePackage` (`categoryId`, `name`, `description`, `price`, `durationMinutes`, `platformFeePercent`, `updatedAt`)
SELECT `id`, 'Carpenter inspection', 'Inspection and minor adjustment; materials charged separately', 349, 60, 20, CURRENT_TIMESTAMP(3) FROM `ServiceCategory` WHERE `slug` = 'carpentry';
