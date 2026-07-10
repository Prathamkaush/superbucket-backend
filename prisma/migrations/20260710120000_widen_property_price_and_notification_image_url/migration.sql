ALTER TABLE `Property`
  MODIFY `price` DECIMAL(15, 2) NOT NULL;

ALTER TABLE `Notification`
  MODIFY `imageUrl` TEXT NULL;
