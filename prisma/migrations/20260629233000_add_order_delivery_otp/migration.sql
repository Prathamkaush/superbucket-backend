ALTER TABLE `Order`
  ADD COLUMN `deliveryOtp` VARCHAR(191) NULL,
  ADD COLUMN `deliveryOtpVerifiedAt` DATETIME(3) NULL;
