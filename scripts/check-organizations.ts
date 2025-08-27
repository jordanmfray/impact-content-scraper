import { prisma } from '../src/lib/db'

async function checkOrganizations() {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { name: 'asc' }
    })
    
    console.log(`Found ${organizations.length} organizations in database:`)
    
    for (const org of organizations) {
      console.log(`- ${org.name}`)
      if (org.website) {
        console.log(`  Website: ${org.website}`)
      }
      if (org.description) {
        console.log(`  Description: ${org.description.substring(0, 100)}${org.description.length > 100 ? '...' : ''}`)
      }
      console.log()
    }
  } catch (error) {
    console.error('Error checking organizations:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkOrganizations()
