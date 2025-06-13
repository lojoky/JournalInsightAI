const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database configuration
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

function convertImageToBase64(filePath) {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Data = imageBuffer.toString('base64');
    
    // Determine MIME type from file extension
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg'; // default
    
    switch (ext) {
      case '.png':
        mimeType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg';
        break;
      case '.gif':
        mimeType = 'image/gif';
        break;
      case '.webp':
        mimeType = 'image/webp';
        break;
      case '.heic':
        mimeType = 'image/heic';
        break;
    }
    
    return { data: base64Data, mimeType };
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

async function migrateImagesToDatabase() {
  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Get all journal entries with originalImageUrl
    const entriesResult = await client.query(`
      SELECT id, original_image_url, image_data, image_mime_type 
      FROM journal_entries 
      WHERE original_image_url IS NOT NULL 
      AND (image_data IS NULL OR image_data = '')
    `);

    console.log(`📊 Found ${entriesResult.rows.length} entries with images to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const entry of entriesResult.rows) {
      try {
        // Extract filename from URL
        const imageUrl = entry.original_image_url;
        let filePath = null;

        if (imageUrl.startsWith('/uploads/')) {
          // File-based URL
          const filename = imageUrl.replace('/uploads/', '');
          filePath = path.join(process.cwd(), 'uploads', filename);
        } else if (imageUrl.startsWith('/api/images/')) {
          // Already migrated to database
          console.log(`⏭️  Entry ${entry.id}: Already using database storage`);
          skippedCount++;
          continue;
        }

        if (filePath && fs.existsSync(filePath)) {
          console.log(`📷 Processing entry ${entry.id}: ${path.basename(filePath)}`);
          
          const imageInfo = convertImageToBase64(filePath);
          if (imageInfo) {
            // Check file size (limit to 10MB)
            const sizeInBytes = (imageInfo.data.length * 3) / 4;
            if (sizeInBytes > 10 * 1024 * 1024) {
              console.log(`⚠️  Entry ${entry.id}: Image too large (${Math.round(sizeInBytes / 1024 / 1024)}MB), skipping`);
              errorCount++;
              continue;
            }

            // Update database with image data
            await client.query(`
              UPDATE journal_entries 
              SET image_data = $1, image_mime_type = $2, original_image_url = $3
              WHERE id = $4
            `, [
              imageInfo.data,
              imageInfo.mimeType,
              `/api/images/${Date.now()}-${entry.id}`,
              entry.id
            ]);

            console.log(`✅ Entry ${entry.id}: Migrated to database storage`);
            migratedCount++;
          } else {
            console.log(`❌ Entry ${entry.id}: Failed to convert image`);
            errorCount++;
          }
        } else {
          console.log(`📁 Entry ${entry.id}: Image file not found (${filePath})`);
          // Update URL to use database endpoint even if file is missing
          await client.query(`
            UPDATE journal_entries 
            SET original_image_url = $1
            WHERE id = $2
          `, [`/api/images/${Date.now()}-${entry.id}`, entry.id]);
          
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing entry ${entry.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📈 MIGRATION SUMMARY:');
    console.log('===================');
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Already migrated: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${migratedCount + skippedCount + errorCount}`);

    if (migratedCount > 0) {
      console.log('\n🎉 Image migration completed successfully!');
      console.log('Images are now stored in the database and will persist across deployments.');
    } else {
      console.log('\n💡 No images needed migration.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

// Run migration
console.log('🖼️  Image Database Migration Tool');
console.log('================================');
console.log('Moving images from file system to database for deployment persistence...\n');

migrateImagesToDatabase();