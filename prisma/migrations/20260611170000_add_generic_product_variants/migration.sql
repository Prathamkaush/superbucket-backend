ALTER TABLE `Product`
    ADD COLUMN `specifications` JSON NULL,
    ADD COLUMN `warranty` VARCHAR(191) NULL,
    ADD COLUMN `shelfLife` VARCHAR(191) NULL,
    ADD COLUMN `storageInstructions` TEXT NULL,
    ADD COLUMN `hsnCode` VARCHAR(191) NULL;

ALTER TABLE `ProductVariant`
    ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `attributes` JSON NULL,
    ADD COLUMN `barcode` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `ProductVariant_barcode_key`
    ON `ProductVariant`(`barcode`);
