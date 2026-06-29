ALTER TABLE `Settings`
  ADD COLUMN `deliverySlotTimes` JSON NULL;

ALTER TABLE `Order`
  ADD COLUMN `deliveryMode` VARCHAR(191) NULL DEFAULT 'INSTANT',
  ADD COLUMN `scheduledDeliveryAt` DATETIME(3) NULL,
  ADD COLUMN `deliverySlotLabel` VARCHAR(191) NULL;
