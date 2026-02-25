-- CreateTable
CREATE TABLE "QuoteSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "sourceAddress" TEXT NOT NULL,
    "solanaAddress" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "selectedRouteJson" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "sourceChainId" TEXT NOT NULL,
    "sourceToken" TEXT NOT NULL,
    "sourceAmount" TEXT NOT NULL,
    "destToken" TEXT NOT NULL,
    "estimatedOutput" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "chainType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "txHashOrSig" TEXT,
    "metaJson" TEXT,
    CONSTRAINT "Step_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuoteSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceChainType" TEXT NOT NULL DEFAULT 'evm',
    "sourceChainId" INTEGER NOT NULL,
    "sourceTokenAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "solanaMint" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "providerConfig" TEXT DEFAULT '{}',
    "verifiedAt" DATETIME,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "TokenVerificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectTokenId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "TokenVerificationLog_projectTokenId_fkey" FOREIGN KEY ("projectTokenId") REFERENCES "ProjectToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerWallet" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sourceChainId" INTEGER NOT NULL,
    "sourceTokenAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Token_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MigrationCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "snapshotBlock" TEXT NOT NULL,
    "merkleRoot" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MigrationCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MigrationCampaign_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SnapshotEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    CONSTRAINT "SnapshotEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MigrationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "proof" TEXT NOT NULL DEFAULT '[]',
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    CONSTRAINT "Claim_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MigrationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Step_sessionId_index_key" ON "Step"("sessionId", "index");

-- CreateIndex
CREATE INDEX "ProjectToken_status_symbol_idx" ON "ProjectToken"("status", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectToken_sourceChainId_sourceTokenAddress_key" ON "ProjectToken"("sourceChainId", "sourceTokenAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Token_projectId_idx" ON "Token"("projectId");

-- CreateIndex
CREATE INDEX "Token_sourceChainId_sourceTokenAddress_idx" ON "Token"("sourceChainId", "sourceTokenAddress");

-- CreateIndex
CREATE INDEX "MigrationCampaign_projectId_idx" ON "MigrationCampaign"("projectId");

-- CreateIndex
CREATE INDEX "MigrationCampaign_tokenId_idx" ON "MigrationCampaign"("tokenId");

-- CreateIndex
CREATE INDEX "SnapshotEntry_campaignId_address_idx" ON "SnapshotEntry"("campaignId", "address");

-- CreateIndex
CREATE INDEX "Claim_campaignId_address_idx" ON "Claim"("campaignId", "address");
