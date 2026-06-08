-- Allow admins to create products with only a category selected.
ALTER TABLE `Product` DROP FOREIGN KEY `Product_typeId_fkey`;
ALTER TABLE `Product` DROP FOREIGN KEY `Product_subtypeId_fkey`;

ALTER TABLE `Product` MODIFY `typeId` INTEGER NULL;
ALTER TABLE `Product` MODIFY `subtypeId` INTEGER NULL;

ALTER TABLE `Product` ADD CONSTRAINT `Product_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `ProductType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Product` ADD CONSTRAINT `Product_subtypeId_fkey` FOREIGN KEY (`subtypeId`) REFERENCES `ProductSubtype`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
