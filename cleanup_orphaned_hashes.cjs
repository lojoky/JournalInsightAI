const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function cleanupOrphanedHashes() {
  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Check for any potential constraint violations or orphaned records
    console.log('🔍 Analyzing hash constraints...');

    // Look for entries with duplicate hashes (should not exist due to UNIQUE constraints)
    const duplicateImageHashes = await client.query(`
      SELECT image_hash, COUNT(*) as count, array_agg(id) as entry_ids
      FROM journal_entries 
      WHERE image_hash IS NOT NULL 
      GROUP BY image_hash 
      HAVING COUNT(*) > 1
    `);

    const duplicateTranscriptHashes = await client.query(`
      SELECT transcript_hash, COUNT(*) as count, array_agg(id) as entry_ids
      FROM journal_entries 
      WHERE transcript_hash IS NOT NULL 
      GROUP BY transcript_hash 
      HAVING COUNT(*) > 1
    `);

    console.log(`📊 Found ${duplicateImageHashes.rows.length} duplicate image hashes`);
    console.log(`📊 Found ${duplicateTranscriptHashes.rows.length} duplicate transcript hashes`);

    // If duplicates exist, clean them up
    if (duplicateImageHashes.rows.length > 0) {
      console.log('🧹 Cleaning up duplicate image hashes...');
      for (const row of duplicateImageHashes.rows) {
        const entryIds = row.entry_ids;
        // Keep the first entry, clear hash from others
        for (let i = 1; i < entryIds.length; i++) {
          await client.query(`
            UPDATE journal_entries 
            SET image_hash = NULL 
            WHERE id = $1
          `, [entryIds[i]]);
          console.log(`  ✓ Cleared image hash from entry ${entryIds[i]}`);
        }
      }
    }

    if (duplicateTranscriptHashes.rows.length > 0) {
      console.log('🧹 Cleaning up duplicate transcript hashes...');
      for (const row of duplicateTranscriptHashes.rows) {
        const entryIds = row.entry_ids;
        // Keep the first entry, clear hash from others
        for (let i = 1; i < entryIds.length; i++) {
          await client.query(`
            UPDATE journal_entries 
            SET transcript_hash = NULL 
            WHERE id = $1
          `, [entryIds[i]]);
          console.log(`  ✓ Cleared transcript hash from entry ${entryIds[i]}`);
        }
      }
    }

    // Verify constraints are working
    console.log('🔧 Verifying hash constraints...');
    
    const constraintCheck = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'journal_entries' 
      AND constraint_type = 'UNIQUE'
    `);

    console.log('📋 Active UNIQUE constraints:');
    constraintCheck.rows.forEach(row => {
      console.log(`  - ${row.constraint_name}: ${row.constraint_type}`);
    });

    // Check current hash statistics
    const hashStats = await client.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT image_hash) as unique_image_hashes,
        COUNT(image_hash) as entries_with_image_hash,
        COUNT(DISTINCT transcript_hash) as unique_transcript_hashes,
        COUNT(transcript_hash) as entries_with_transcript_hash
      FROM journal_entries
    `);

    console.log('\n📈 CURRENT HASH STATISTICS:');
    console.log('============================');
    const stats = hashStats.rows[0];
    console.log(`Total entries: ${stats.total_entries}`);
    console.log(`Entries with image hash: ${stats.entries_with_image_hash}`);
    console.log(`Unique image hashes: ${stats.unique_image_hashes}`);
    console.log(`Entries with transcript hash: ${stats.entries_with_transcript_hash}`);
    console.log(`Unique transcript hashes: ${stats.unique_transcript_hashes}`);

    if (duplicateImageHashes.rows.length === 0 && duplicateTranscriptHashes.rows.length === 0) {
      console.log('\n✅ NO ISSUES FOUND');
      console.log('Duplicate detection should be working correctly.');
      console.log('If you\'re still experiencing issues, they may be related to:');
      console.log('  - Browser caching');
      console.log('  - File upload timing');
      console.log('  - Specific image formats');
    } else {
      console.log('\n🎉 CLEANUP COMPLETED');
      console.log('Removed duplicate hash constraints that could prevent re-uploads.');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await client.end();
  }
}

console.log('🧹 Hash Constraint Cleanup Tool');
console.log('===============================');
console.log('Cleaning up any orphaned hash constraints that might prevent re-uploads...\n');

cleanupOrphanedHashes();