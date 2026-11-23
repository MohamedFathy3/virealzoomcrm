CREATE TABLE `ClientPayment` (
    `id` VARCHAR(191) NOT NULL,
    `paymentNo` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `serviceRevenueAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `adBudgetAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `date` DATETIME(3) NOT NULL,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `financeTransactionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ClientPayment_paymentNo_key`(`paymentNo`),
    UNIQUE INDEX `ClientPayment_financeTransactionId_key`(`financeTransactionId`),
    INDEX `ClientPayment_clientId_date_idx`(`clientId`, `date`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ClientPayment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `ClientPayment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `ClientPayment_financeTransactionId_fkey` FOREIGN KEY (`financeTransactionId`) REFERENCES `FinanceTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
);
