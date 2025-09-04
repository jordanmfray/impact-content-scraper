const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkArticles() {
  try {
    const total = await prisma.article.count()
    console.log(`Total articles in database: ${total}`)
    
    const byStatus = await prisma.article.groupBy({
      by: ['status'],
      _count: { status: true }
    })
    
    console.log('Articles by status:')
    byStatus.forEach(group => {
      console.log(`  ${group.status}: ${group._count.status}`)
    })
    
    const recent = await prisma.article.findMany({
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    console.log('\nMost recent 10 articles:')
    recent.forEach(article => {
      console.log(`  [${article.status}] ${article.title.substring(0, 50)}... (${article.createdAt.toISOString()})`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkArticles()
