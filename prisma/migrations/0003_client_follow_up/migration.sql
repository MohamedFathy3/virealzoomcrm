ALTER TABLE `Client`
    ADD COLUMN `nextFollowUpAt` DATETIME(3) NULL,
    ADD COLUMN `followUpNote` TEXT NULL;

ALTER TABLE `Task`
    MODIFY COLUMN `description` TEXT NULL;

ALTER TABLE `TaskSubmission`
    MODIFY COLUMN `completionNotes` TEXT NULL;

ALTER TABLE `TaskReview`
    MODIFY COLUMN `comments` TEXT NULL;

ALTER TABLE `TaskComment`
    MODIFY COLUMN `body` TEXT NOT NULL;
