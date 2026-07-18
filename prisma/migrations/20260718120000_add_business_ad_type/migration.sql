ALTER TABLE `BusinessAd`
  ADD COLUMN `adType` ENUM('BUSINESS', 'LOCAL_SHOP') NOT NULL DEFAULT 'BUSINESS';

CREATE INDEX `BusinessAd_adType_status_startsAt_expiresAt_idx`
  ON `BusinessAd`(`adType`, `status`, `startsAt`, `expiresAt`);
