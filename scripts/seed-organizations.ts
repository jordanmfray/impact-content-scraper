import { prisma } from '../src/lib/db'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

interface OrganizationData {
  name: string
  description: string
  website: string
  newsUrl?: string
  tags?: string[]
  ein?: string
}

async function parseOrganizationsFromMarkdown(): Promise<OrganizationData[]> {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const filePath = path.join(__dirname, '..', 'oranizations-seeder.md')
  const content = fs.readFileSync(filePath, 'utf-8')
  
  const organizations: OrganizationData[] = []
  const lines = content.split('\n')
  
  // Skip header lines and find table rows
  for (const line of lines) {
    // Look for table rows (start with | and contain organization data)
    if (line.startsWith('|') && !line.includes('---') && !line.includes('Organization Name')) {
      const columns = line.split('|').map(col => col.trim()).filter(col => col)
      
      if (columns.length >= 3) {
        const name = columns[0]
        const description = columns[1]
        const websiteMatch = columns[2].match(/\[([^\]]+)\]\(([^)]+)\)/)
        
        if (name && description && websiteMatch) {
          const website = websiteMatch[2]
          organizations.push({
            name: name.trim(),
            description: description.trim(),
            website: website.trim()
          })
        }
      }
    }
  }
  
  return organizations
}



async function seedOrganizations() {
  console.log('🌱 Starting organization seeding...')
  
  try {
    const organizations = await parseOrganizationsFromMarkdown()
    console.log(`📊 Found ${organizations.length} organizations to seed`)
    
    for (const org of organizations) {
      // Check if organization already exists
      const existing = await prisma.organization.findFirst({
        where: {
          OR: [
            { name: org.name }
          ]
        }
      })
      if (existing) {
        console.log(`⏭️  Skipping ${org.name} - already exists`)
        continue
      }
      
      // Create organization
      const createdOrg = await prisma.organization.create({
        data: {
          name: org.name,
          description: org.description,
          website: org.website,
          newsUrl: org.newsUrl || null,
          tags: org.tags || [],
          ein: org.ein || null,
        }
      })

      console.log(`✅ Created organization: ${org.name}`)
    }
    
    console.log('🎉 Organization seeding completed!')
    
    // Show summary
    const totalOrgs = await prisma.organization.count()
    console.log(`📈 Total organizations in database: ${totalOrgs}`)
    
  } catch (error) {
    console.error('❌ Error seeding organizations:', error)
    throw error
  }
}

// Run the seeding function
seedOrganizations()
  .then(() => {
    console.log('✨ Seeding process completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seeding process failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

export { seedOrganizations }