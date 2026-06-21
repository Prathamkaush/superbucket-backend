ALTER TABLE `OrderItem`
    ADD COLUMN `variantName` VARCHAR(191) NULL,
    ADD COLUMN `variantAttributes` JSON NULL;
