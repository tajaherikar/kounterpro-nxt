#!/usr/bin/env node
/**
 * Run database migrations
 * Usage: node scripts/run-migration.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runMigrations() {
  try {
    console.log('🔄 Running migration: 001-create-business-profile.sql')

    const migrationPath = path.join(__dirname, '../database/001-create-business-profile.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0)

    for (const statement of statements) {
      const trimmed = statement.trim()
      if (trimmed.startsWith('--')) continue // Skip comments

      console.log(`  ▸ Executing: ${trimmed.substring(0, 50)}...`)
      
      const { error } = await supabase.rpc('exec', { sql: trimmed })
      if (error && !error.message.includes('already exists')) {
        console.error(`  ✗ Error: ${error.message}`)
      } else {
        console.log(`  ✓ Done`)
      }
    }

    console.log('✅ Migration completed!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigrations()
