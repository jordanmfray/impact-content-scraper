#!/usr/bin/env node

/**
 * Quick script to test database connections and environment setup
 * Run with: node scripts/test-connection.js
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const requiredEnvs = [
  'DATABASE_URL',
  'SUPABASE_URL', 
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const optionalEnvs = [
  'OPENAI_API_KEY',
  'FIRECRAWL_API_KEY', 
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY'
];

async function testEnvironment() {
  console.log('🔍 Testing Environment Configuration...\n');

  // Check required environment variables
  const missing = requiredEnvs.filter(env => !process.env[env] || process.env[env].includes('[YOUR_'));
  
  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(env => console.log(`   - ${env}`));
    console.log('\n💡 Please update your .env.local file with actual values.\n');
    return false;
  }

  console.log('✅ Required environment variables are set\n');

  // Check optional environment variables
  const missingOptional = optionalEnvs.filter(env => !process.env[env] || process.env[env].includes('[YOUR_'));
  if (missingOptional.length > 0) {
    console.log('⚠️  Optional environment variables not set (you can add these later):');
    missingOptional.forEach(env => console.log(`   - ${env}`));
    console.log('');
  }

  return true;
}

async function testSupabaseConnection() {
  console.log('�� Testing Supabase Connection...\n');

  try {
    // Test with anon key first
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase.from('_prisma_migrations').select('*').limit(1);
    
    if (error && error.code !== '42P01') { // 42P01 = table does not exist (which is fine)
      throw error;
    }

    console.log('✅ Supabase connection successful');

    // Test service role key
    const supabaseService = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: serviceData, error: serviceError } = await supabaseService.from('_prisma_migrations').select('*').limit(1);
    
    if (serviceError && serviceError.code !== '42P01') {
      throw serviceError;
    }

    console.log('✅ Supabase Service Role key working\n');
    return true;

  } catch (error) {
    console.log('❌ Supabase connection failed:');
    console.log(`   Error: ${error.message}\n`);
    return false;
  }
}

async function testPrismaConnection() {
  console.log('🔍 Testing Prisma Database Connection...\n');

  try {
    const prisma = new PrismaClient();
    
    // Test the connection
    await prisma.$connect();
    console.log('✅ Prisma connection successful');

    // Check if migrations have been run
    try {
      const result = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Organization'`;
      
      if (result.length > 0) {
        console.log('✅ Database tables exist (migrations have been run)');
      } else {
        console.log('⚠️  Database tables not found. You may need to run: npm run prisma:migrate');
      }
    } catch (error) {
      console.log('⚠️  Could not check for tables. You may need to run: npm run prisma:migrate');
    }

    await prisma.$disconnect();
    console.log('');
    return true;

  } catch (error) {
    console.log('❌ Prisma connection failed:');
    console.log(`   Error: ${error.message}`);
    console.log('   Check your DATABASE_URL in .env.local\n');
    return false;
  }
}

async function checkSchemas() {
  console.log('🔍 Checking Database Schemas...\n');

  try {
    const prisma = new PrismaClient();
    await prisma.$connect();

    // Check for required schemas
    const schemas = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('app', 'cms', 'public')
    `;

    const foundSchemas = schemas.map(s => s.schema_name);
    
    console.log('Found schemas:', foundSchemas);

    if (!foundSchemas.includes('app')) {
      console.log('⚠️  "app" schema not found. Creating it...');
      await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS app`;
      console.log('✅ Created "app" schema');
    }

    if (!foundSchemas.includes('cms')) {
      console.log('⚠️  "cms" schema not found. Creating it...');
      await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS cms`;
      console.log('✅ Created "cms" schema');
    }

    // Check for pgvector extension
    try {
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log('✅ pgvector extension enabled');
    } catch (error) {
      console.log('⚠️  Could not enable pgvector extension (may not be available)');
    }

    await prisma.$disconnect();
    console.log('');
    return true;

  } catch (error) {
    console.log('❌ Schema check failed:');
    console.log(`   Error: ${error.message}\n`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Connection Tests\n');
  console.log('=' .repeat(50));
  console.log('');

  const envOk = await testEnvironment();
  if (!envOk) return;

  const supabaseOk = await testSupabaseConnection();
  const prismaOk = await testPrismaConnection();
  const schemasOk = await checkSchemas();

  console.log('=' .repeat(50));
  console.log('📋 TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`Environment Variables: ${envOk ? '✅' : '❌'}`);
  console.log(`Supabase Connection:   ${supabaseOk ? '✅' : '❌'}`);
  console.log(`Prisma Connection:     ${prismaOk ? '✅' : '❌'}`);
  console.log(`Database Schemas:      ${schemasOk ? '✅' : '❌'}`);
  console.log('');

  if (envOk && supabaseOk && prismaOk && schemasOk) {
    console.log('🎉 All tests passed! Your environment is ready.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run migrations: npm run prisma:migrate');
    console.log('2. Start the development servers: npm run dev');
  } else {
    console.log('⚠️  Some tests failed. Please fix the issues above before proceeding.');
  }
}

main().catch(console.error);
