ALTER TABLE `Property` ADD COLUMN `pincode` VARCHAR(191) NULL;

CREATE INDEX `Property_pincode_idx` ON `Property`(`pincode`);
