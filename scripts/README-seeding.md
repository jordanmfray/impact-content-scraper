# 🌱 **Database Seeding System**

This guide explains how to populate your development environment with rich content using our automated seeding system.

## 📋 **Overview**

Our seeding system provides two types of seed data:
- **🏢 Organizations**: Real organization data from `oranizations-seeder.md`
- **📰 Articles**: Real article content created by our scraping pipeline

## 🚀 **Quick Start**

### **Seed Everything (Recommended)**
```bash
npm run seed:all
```
This seeds both organizations (11) and articles (5) in the correct order.

### **Seed Individual Components**
```bash
# Organizations only
npm run seed:organizations

# Articles only (requires organizations to exist first)
npm run seed:articles
```

### **Reset and Reseed**
```bash
# Reset database and reseed everything
npx prisma migrate reset --force
npm run seed:all
```

## 📊 **What Gets Seeded**

### **🏢 Organizations (11 total)**
- Lausanne Committee for World Evangelization
- Alpha USA  
- Compassion International, Inc.
- GuideStone
- Celebrate Recovery
- ECFA (Evangelical Council for Financial Accountability)
- Southern Baptist Convention
- Church of the Nazarene
- International Justice Mission
- City Help Inc of Phoenix (Phoenix Dream Center)
- Wesleyan Investment Foundation

### **📰 Articles (5 total)**
- **IJM**: Latest Updates - Global justice and freedom initiatives
- **Compassion**: Financial transparency and child development programs  
- **Alpha USA**: Faith exploration resources and supportive environments
- **ECFA**: Financial accountability standards for nonprofits
- **Church of the Nazarene**: Archives and global ministry overview

Each article includes:
- ✅ **Complete metadata**: Title, summary, keywords, sentiment
- ✅ **Raw content**: Original scraped text/HTML/markdown
- ✅ **AI analysis**: Enriched with structured data extraction
- ✅ **Organization links**: Connected to real organizations

## 🔄 **How Articles Were Created**

Our article seed data comes from **real scraping pipeline results**:

1. **Manual Scraping**: Used `npm run manual-scrape` on real organization URLs
2. **AI Processing**: Vercel AI SDK analyzed content for titles, summaries, keywords
3. **Export Process**: `scripts/export-articles.ts` captured real pipeline output  
4. **Seed Data**: Stored in `scripts/seed-data/articles.json`

This ensures seed data **matches production data structures exactly**.

## 🛡️ **Duplicate Protection**

Both seeders have built-in duplicate protection:
- **Organizations**: Skip if any exist in database
- **Articles**: Skip if specific URL already exists
- **Smart detection**: Warns about duplicates and provides reset instructions

## 📁 **File Structure**

```
scripts/
├── seed-organizations.ts       # Organization seeder
├── seed-articles.ts           # Article seeder  
├── export-articles.ts         # Export live articles to seed data
├── manual-scrape.ts          # Create new articles manually
├── seed-data/
│   └── articles.json         # Exported article seed data
└── README-seeding.md         # This documentation
```

## 🔧 **Advanced Usage**

### **Adding New Articles to Seed Data**

1. **Create new articles**:
   ```bash
   npm run manual-scrape -- https://example.org/news "Organization Name"
   ```

2. **Export updated articles**:
   ```bash
   npx tsx -e "import { exportArticles } from './scripts/export-articles'; exportArticles()"
   ```

3. **Test new seed data**:
   ```bash
   npx prisma migrate reset --force
   npm run seed:all
   ```

### **Customizing Seed Data**

Edit `scripts/seed-data/articles.json` directly to:
- Modify article content
- Update keywords/sentiment
- Change organization assignments
- Add custom metadata

### **Creating Organization-Specific Seeds**

You can create targeted seed data for specific organizations:

```typescript
// In seed-articles.ts, filter by organization:
const filteredArticles = seedData.filter(article => 
  article.organization.name === "Target Organization"
)
```

## 🧪 **Testing Your Changes**

Always test seeding after making changes:

```bash
# Test complete workflow
npx prisma migrate reset --force && npm run seed:all

# Verify results
npx tsx -e "
import { prisma } from './src/lib/db'
async function main() {
  const orgs = await prisma.organization.count()
  const articles = await prisma.article.count()
  console.log(\`🏢 Organizations: \${orgs}\`)
  console.log(\`📰 Articles: \${articles}\`)
  await prisma.\$disconnect()
}
main()
"
```

## 🎯 **Benefits**

✅ **Rich Development Environment**: Always have realistic content  
✅ **Consistent Data**: Same seed data across all environments  
✅ **Real Pipeline Output**: Articles match production data structures  
✅ **Fast Setup**: Complete environment in seconds  
✅ **No External Dependencies**: Works offline with pre-generated content  
✅ **Easy Maintenance**: Simple scripts to update and extend

## 📝 **Package.json Scripts Reference**

```json
{
  "seed:organizations": "tsx scripts/seed-organizations.ts",
  "seed:articles": "tsx scripts/seed-articles.ts", 
  "seed:all": "npm run seed:organizations && npm run seed:articles",
  "manual-scrape": "tsx scripts/manual-scrape.ts"
}
```

---

**🎉 Happy seeding!** Your development environment will now always be rich with realistic content.
