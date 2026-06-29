CREATE TABLE `Shop` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `address` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL,
  `pincode` VARCHAR(191) NOT NULL,
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `radiusKm` INTEGER NOT NULL DEFAULT 5,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `ownerId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Shop_ownerId_key`(`ownerId`),
  INDEX `Shop_pincode_idx`(`pincode`),
  INDEX `Shop_isActive_idx`(`isActive`),
  INDEX `Shop_latitude_longitude_idx`(`latitude`, `longitude`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User`
  MODIFY `role` ENUM('USER', 'ADMIN', 'SUB_ADMIN', 'PICKER', 'DELIVERY_PARTNER') NOT NULL DEFAULT 'USER',
  ADD COLUMN `staffShopId` INTEGER NULL;

ALTER TABLE `Order`
  ADD COLUMN `shopId` INTEGER NULL,
  ADD COLUMN `deliveryPartnerId` INTEGER NULL,
  ADD COLUMN `deliveryPartnerName` VARCHAR(191) NULL,
  ADD COLUMN `deliveryPartnerPhone` VARCHAR(191) NULL,
  ADD COLUMN `deliveryLatitude` DECIMAL(10, 7) NULL,
  ADD COLUMN `deliveryLongitude` DECIMAL(10, 7) NULL,
  ADD COLUMN `deliveryLocationUpdatedAt` DATETIME(3) NULL;

CREATE INDEX `User_staffShopId_idx` ON `User`(`staffShopId`);
CREATE INDEX `Order_shopId_idx` ON `Order`(`shopId`);
CREATE INDEX `Order_deliveryPartnerId_idx` ON `Order`(`deliveryPartnerId`);

ALTER TABLE `Shop`
  ADD CONSTRAINT `Shop_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `User`
  ADD CONSTRAINT `User_staffShopId_fkey`
  FOREIGN KEY (`staffShopId`) REFERENCES `Shop`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_shopId_fkey`
  FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_deliveryPartnerId_fkey`
  FOREIGN KEY (`deliveryPartnerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
