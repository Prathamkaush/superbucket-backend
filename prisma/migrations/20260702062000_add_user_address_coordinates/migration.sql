ALTER TABLE `UserAddress`
  ADD COLUMN `latitude` DECIMAL(10, 7) NULL,
  ADD COLUMN `longitude` DECIMAL(10, 7) NULL;

CREATE INDEX `UserAddress_latitude_longitude_idx` ON `UserAddress`(`latitude`, `longitude`);
