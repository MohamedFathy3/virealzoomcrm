CREATE TABLE `ClientServiceInterest` (
    `clientId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `catalogPrice` DECIMAL(12, 2) NULL,
    `discountPercent` DECIMAL(5, 2) NULL,
    `increaseAmount` DECIMAL(12, 2) NULL,
    `finalPrice` DECIMAL(12, 2) NULL,
    `serviceDescription` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClientServiceInterest_serviceId_idx`(`serviceId`),
    PRIMARY KEY (`clientId`, `serviceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientServiceInterest`
    ADD CONSTRAINT `ClientServiceInterest_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ClientServiceInterest`
    ADD CONSTRAINT `ClientServiceInterest_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Client`
    ADD COLUMN `proposalTotal` DECIMAL(12, 2) NULL;
