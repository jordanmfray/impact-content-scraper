#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { ministries } from '../investor-portal-org-data.js';

const prisma = new PrismaClient();

interface InvestorPortalOrg {
  id: string;
  name: string;
  altNames?: string[];
  websiteUrl?: string;
  ein?: string;
  tagline?: string;
  categories?: string[];
  impactAreas?: string[];
  description?: string;
  isFeatured?: boolean;
  logos?: Array<{ url: string; [key: string]: any }>; // Not used in current schema
  images?: Array<{ url: string; [key: string]: any }>; // Not used in current schema
  [key: string]: any;
}

function extractWebsiteUrl(websiteUrl?: string): string | null {
  if (!websiteUrl) return null;
  
  // Add https:// if no protocol is specified
  if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
    return `https://${websiteUrl}`;
  }
  
  return websiteUrl;
}

// Logo and banner image extraction functions removed - these fields no longer exist in schema

function combineTags(categories?: string[], impactAreas?: string[]): string[] {
  const allTags = new Set<string>();
  
  // Add categories
  if (categories) {
    categories.forEach(cat => allTags.add(cat.toLowerCase().trim()));
  }
  
  // Add impact areas with some normalization
  if (impactAreas) {
    impactAreas.forEach(area => {
      // Convert kebab-case to readable format
      const readable = area.replace(/-/g, ' ').toLowerCase().trim();
      allTags.add(readable);
    });
  }
  
  return Array.from(allTags);
}

async function seedFromInvestorPortal() {
  console.log(`🌱 Starting to seed ${ministries.length} organizations from investor portal data...`);
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const ministry of ministries as InvestorPortalOrg[]) {
    try {
      // Check if organization already exists by name
      const existingOrg = await prisma.organization.findFirst({
        where: { name: ministry.name }
      });
      
      if (existingOrg) {
        console.log(`⏭️  Skipping "${ministry.name}" - already exists`);
        skipped++;
        continue;
      }
      
      // Prepare the data
      const orgData = {
        name: ministry.name,
        description: ministry.description || null,
        website: extractWebsiteUrl(ministry.websiteUrl),
        newsUrl: null, // Not available in source data
        tags: combineTags(ministry.categories, ministry.impactAreas),
        ein: ministry.ein || null,
      };
      
      // Create the organization
      await prisma.organization.create({ data: orgData });
      
      console.log(`✅ Created organization: ${ministry.name}`);
      created++;
      
    } catch (error) {
      console.error(`❌ Error creating organization "${ministry.name}":`, error);
      errors++;
    }
  }
  
  console.log(`\n📊 Seeding completed:`);
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📋 Total processed: ${ministries.length}`);
}

async function main() {
  try {
    await seedFromInvestorPortal();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script when executed directly
main();

export { seedFromInvestorPortal };
