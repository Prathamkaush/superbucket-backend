ALTER TABLE `Review` DROP FOREIGN KEY `Review_orderId_fkey`;

CREATE INDEX `Review_userId_idx` ON `Review`(`userId`);
CREATE INDEX `Review_productId_idx` ON `Review`(`productId`);
CREATE INDEX `Review_orderId_idx` ON `Review`(`orderId`);

DROP INDEX `Review_userId_productId_orderId_key` ON `Review`;

ALTER TABLE `Review` MODIFY `orderId` INTEGER NULL;

ALTER TABLE `Review`
  ADD CONSTRAINT `Review_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX `Review_userId_productId_key` ON `Review`(`userId`, `productId`);
