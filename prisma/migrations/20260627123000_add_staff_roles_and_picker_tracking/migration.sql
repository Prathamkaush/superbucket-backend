ALTER TABLE `User`
  MODIFY `role` ENUM('USER', 'ADMIN', 'SUB_ADMIN', 'PICKER') NOT NULL DEFAULT 'USER',
  ADD COLUMN `createdById` INTEGER NULL;

ALTER TABLE `Order`
  ADD COLUMN `acceptedAt` DATETIME(3) NULL,
  ADD COLUMN `dispatchedAt` DATETIME(3) NULL,
  ADD COLUMN `fulfilledAt` DATETIME(3) NULL,
  ADD COLUMN `acceptedById` INTEGER NULL,
  ADD COLUMN `dispatchedById` INTEGER NULL,
  ADD COLUMN `fulfilledById` INTEGER NULL;

CREATE INDEX `User_createdById_idx` ON `User`(`createdById`);
CREATE INDEX `Order_acceptedById_idx` ON `Order`(`acceptedById`);
CREATE INDEX `Order_dispatchedById_idx` ON `Order`(`dispatchedById`);
CREATE INDEX `Order_fulfilledById_idx` ON `Order`(`fulfilledById`);

ALTER TABLE `User`
  ADD CONSTRAINT `User_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_acceptedById_fkey`
  FOREIGN KEY (`acceptedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Order_dispatchedById_fkey`
  FOREIGN KEY (`dispatchedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Order_fulfilledById_fkey`
  FOREIGN KEY (`fulfilledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
