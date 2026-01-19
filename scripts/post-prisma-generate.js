#!/usr/bin/env node

/**
 * Post-generate script to ensure Prisma Query Engine binary is accessible
 * This is needed for serverless deployments where the binary path resolution can fail
 */

const fs = require('fs');
const path = require('path');

const prismaOutputDir = path.join(__dirname, '../src/generated/prisma');
const binaryName = 'libquery_engine-rhel-openssl-3.0.x.so.node';

// Check if binary exists in the generated directory
const binaryPath = path.join(prismaOutputDir, binaryName);
if (fs.existsSync(binaryPath)) {
  console.log(`✓ Found Prisma Query Engine binary at ${binaryPath}`);
} else {
  console.warn(`⚠ Warning: Prisma Query Engine binary not found at ${binaryPath}`);
  console.warn('This may cause issues in production. Ensure binaryTargets includes "rhel-openssl-3.0.x"');
}
