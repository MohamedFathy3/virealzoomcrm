-- CreateTable
CREATE TABLE `SocialAccount` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X', 'SNAPCHAT', 'THREADS', 'OTHER') NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `username` VARCHAR(255) NOT NULL,
    `passwordEncrypted` TEXT NULL,
    `profileUrl` VARCHAR(2048) NULL,
    `notes` TEXT NULL,
    `externalAccountId` VARCHAR(255) NULL,
    `metaConnectionId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SocialAccount_clientId_platform_idx`(`clientId`, `platform`),
    INDEX `SocialAccount_metaConnectionId_idx`(`metaConnectionId`),
    UNIQUE INDEX `SocialAccount_metaConnectionId_platform_key`(`metaConnectionId`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetaConnection` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `facebookPageId` VARCHAR(255) NOT NULL,
    `facebookPageName` VARCHAR(191) NOT NULL,
    `pageAccessTokenEncrypted` TEXT NOT NULL,
    `instagramAccountId` VARCHAR(255) NULL,
    `instagramUsername` VARCHAR(255) NULL,
    `connectedById` VARCHAR(191) NOT NULL,
    `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MetaConnection_facebookPageId_key`(`facebookPageId`),
    INDEX `MetaConnection_clientId_connectedAt_idx`(`clientId`, `connectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialPost` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X', 'SNAPCHAT', 'THREADS', 'OTHER') NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `status` ENUM('SCHEDULED', 'PUBLISHED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `publishedAt` DATETIME(3) NULL,
    `publishingAt` DATETIME(3) NULL,
    `externalPostId` VARCHAR(255) NULL,
    `publishError` TEXT NULL,
    `media` JSON NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SocialPost_scheduledAt_status_idx`(`scheduledAt`, `status`),
    INDEX `SocialPost_clientId_scheduledAt_idx`(`clientId`, `scheduledAt`),
    INDEX `SocialPost_accountId_scheduledAt_idx`(`accountId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SocialAccount` ADD CONSTRAINT `SocialAccount_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SocialAccount` ADD CONSTRAINT `SocialAccount_metaConnectionId_fkey` FOREIGN KEY (`metaConnectionId`) REFERENCES `MetaConnection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SocialAccount` ADD CONSTRAINT `SocialAccount_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetaConnection` ADD CONSTRAINT `MetaConnection_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetaConnection` ADD CONSTRAINT `MetaConnection_connectedById_fkey` FOREIGN KEY (`connectedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SocialPost` ADD CONSTRAINT `SocialPost_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SocialPost` ADD CONSTRAINT `SocialPost_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `SocialAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SocialPost` ADD CONSTRAINT `SocialPost_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
