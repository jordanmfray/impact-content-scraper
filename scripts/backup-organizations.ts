#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function backupOrganizations() {
  try {
    console.log('🔄 Starting organization backup...');
    
    // Fetch all organizations with all fields
    const organizations = await prisma.organization.findMany({
      orderBy: { name: 'asc' }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + 
                     new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
    
    // Create JSON backup
    const jsonBackup = {
      exportDate: new Date().toISOString(),
      totalOrganizations: organizations.length,
      organizations: organizations
    };
    
    const jsonFilename = `organization-backup-${timestamp}.json`;
    fs.writeFileSync(jsonFilename, JSON.stringify(jsonBackup, null, 2), 'utf-8');
    
    // Create SQL INSERT statements backup
    let sqlContent = `-- Organization Table Backup\n`;
    sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
    sqlContent += `-- Total Records: ${organizations.length}\n\n`;
    sqlContent += `-- Clear existing data (uncomment if needed)\n`;
    sqlContent += `-- DELETE FROM "Organization";\n\n`;
    
    for (const org of organizations) {
      const values = [
        `'${org.id.replace(/'/g, "''")}'`,  // Escape single quotes
        `'${org.name.replace(/'/g, "''")}'`,
        org.description ? `'${org.description.replace(/'/g, "''")}'` : 'NULL',
        org.website ? `'${org.website.replace(/'/g, "''")}'` : 'NULL',
        org.newsUrl ? `'${org.newsUrl.replace(/'/g, "''")}'` : 'NULL',
        org.ein ? `'${org.ein.replace(/'/g, "''")}'` : 'NULL',
        org.tags && org.tags.length > 0 ? `ARRAY[${org.tags.map(tag => `'${tag.replace(/'/g, "''")}'`).join(', ')}]` : 'ARRAY[]::text[]',
        `'${org.createdAt.toISOString()}'::timestamp`,
        `'${org.updatedAt.toISOString()}'::timestamp`
      ];
      
      sqlContent += `INSERT INTO "Organization" (id, name, description, website, "newsUrl", ein, tags, "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
    }
    
    const sqlFilename = `organization-backup-${timestamp}.sql`;
    fs.writeFileSync(sqlFilename, sqlContent, 'utf-8');
    
    // Create restore script
    const restoreScript = `#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function restoreOrganizations() {
  try {
    console.log('🔄 Restoring organizations from backup...');
    
    const backupData = JSON.parse(fs.readFileSync('${jsonFilename}', 'utf-8'));
    const organizations = backupData.organizations;
    
    console.log(\`📊 Found \${organizations.length} organizations to restore\`);
    
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
          console.log(\`✅ Updated: \${org.name}\`);
          updated++;
        } else {
          // Create new
          await prisma.organization.create({
            data: {
              id: org.id,
              ...orgData
            }
          });
          console.log(\`✅ Created: \${org.name}\`);
          created++;
        }
      } catch (error) {
        console.error(\`❌ Error with \${org.name}:\`, error);
        skipped++;
      }
    }
    
    console.log(\`\\n📊 Restore completed:\`);
    console.log(\`   ✅ Created: \${created}\`);
    console.log(\`   🔄 Updated: \${updated}\`);
    console.log(\`   ⏭️  Skipped: \${skipped}\`);
    console.log(\`   📋 Total: \${organizations.length}\`);
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run restore
restoreOrganizations();
`;
    
    const restoreFilename = `restore-organizations-${timestamp}.ts`;
    fs.writeFileSync(restoreFilename, restoreScript, 'utf-8');
    
    console.log('✅ Backup completed successfully!');
    console.log(`📄 Files created:`);
    console.log(`   📊 JSON backup: ${jsonFilename}`);
    console.log(`   🗃️  SQL backup: ${sqlFilename}`);
    console.log(`   🔧 Restore script: ${restoreFilename}`);
    console.log(`\\n📋 Summary:`);
    console.log(`   Organizations backed up: ${organizations.length}`);
    console.log(`   Export date: ${new Date().toISOString()}`);
    
    // Show organizations with news URLs
    const orgsWithNewsUrl = organizations.filter(org => org.newsUrl);
    console.log(`   Organizations with News URLs: ${orgsWithNewsUrl.length}`);
    
    if (orgsWithNewsUrl.length > 0) {
      console.log(`\\n📰 Organizations with News URLs:`);
      orgsWithNewsUrl.forEach(org => {
        console.log(`   - ${org.name}: ${org.newsUrl}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupOrganizations();
