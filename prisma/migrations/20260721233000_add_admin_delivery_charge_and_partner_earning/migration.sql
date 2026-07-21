ALTER TABLE `Settings`
  ADD COLUMN `deliveryChargeUpTo1000` DECIMAL(10, 2) NOT NULL DEFAULT 33.00;

ALTER TABLE `Order`
  ADD COLUMN `deliveryPartnerEarning` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

UPDATE `Order`
SET `deliveryPartnerEarning` = `shippingCharge`
WHERE `totalAmount` >= 1
  AND `totalAmount` <= 1000;
