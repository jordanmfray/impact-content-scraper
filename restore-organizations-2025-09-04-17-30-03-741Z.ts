#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function restoreOrganizations() {
  try {
    console.log('🔄 Restoring organizations from backup...');
    
    const backupData = JSON.parse(fs.readFileSync('organization-backup-2025-09-04-17-30-03-741Z.json', 'utf-8'));
    const organizations = backupData.organizations;
    
    console.log(`📊 Found ${organizations.length} organizations to restore`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const org of organizations) {
      try {
        // Try to find existing organization
        const existing = await prisma.organization.findUnique({
          where: { id: org.id }
        });
        
        const orgData = {
          name: org.name,
          description: org.description,
          website: org.website,
          newsUrl: org.newsUrl,
          ein: org.ein,
          tags: org.tags || [],
          createdAt: new Date(org.createdAt),
          updatedAt: new Date(org.updatedAt)
        };
        
        if (existing) {
          // Update existing
          await prisma.organization.update({
            where: { id: org.id },
            data: orgData
          });
          console.log(`✅ Updated: ${org.name}`);
          updated++;
        } else {
          // Create new
          await prisma.organization.create({
            data: {
              id: org.id,
              ...orgData
            }
          });
          console.log(`✅ Created: ${org.name}`);
          created++;
        }
      } catch (error) {
        console.error(`❌ Error with ${org.name}:`, error);
        skipped++;
      }
    }
    
    console.log(`\n📊 Restore completed:`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📋 Total: ${organizations.length}`);
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run restore
restoreOrganizations();
