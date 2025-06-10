import { Client } from "@notionhq/client";

// Initialize Notion client with user's integration token
export function createNotionClient(integrationToken: string) {
  return new Client({
    auth: integrationToken,
  });
}

// Extract the page ID from the Notion page URL
export function extractPageIdFromUrl(pageUrl: string): string {
  const match = pageUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error("Failed to extract page ID from URL");
}

/**
 * Lists all child databases contained within a page
 */
export async function getNotionDatabases(notion: Client, pageId: string) {
  const childDatabases = [];

  try {
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion.blocks.children.list({
        block_id: pageId,
        start_cursor: startCursor,
      });

      for (const block of response.results) {
        if (block.type === "child_database") {
          const databaseId = block.id;

          try {
            const databaseInfo = await notion.databases.retrieve({
              database_id: databaseId,
            });
            childDatabases.push(databaseInfo);
          } catch (error) {
            console.error(`Error retrieving database ${databaseId}:`, error);
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    return childDatabases;
  } catch (error) {
    console.error("Error listing child databases:", error);
    throw error;
  }
}

// Find a Notion database with the matching title
export async function findDatabaseByTitle(notion: Client, pageId: string, title: string) {
  const databases = await getNotionDatabases(notion, pageId);

  for (const db of databases) {
    if (db.title && Array.isArray(db.title) && db.title.length > 0) {
      const dbTitle = db.title[0]?.plain_text?.toLowerCase() || "";
      if (dbTitle === title.toLowerCase()) {
        return db;
      }
    }
  }

  return null;
}

// Create a new database if one with a matching title does not exist
export async function createDatabaseIfNotExists(notion: Client, pageId: string, title: string, properties: any) {
  const existingDb = await findDatabaseByTitle(notion, pageId, title);
  if (existingDb) {
    return existingDb;
  }

  return await notion.databases.create({
    parent: {
      type: "page_id",
      page_id: pageId
    },
    title: [
      {
        type: "text",
        text: {
          content: title
        }
      }
    ],
    properties
  });
}

// Create journal database with proper schema
export async function createJournalDatabase(notion: Client, pageId: string) {
  return await createDatabaseIfNotExists(notion, pageId, "Journal Entries", {
    Title: {
      title: {}
    },
    Date: {
      date: {}
    },
    Tags: {
      multi_select: {
        options: []
      }
    },
    Photo: {
      files: {}
    },
    "Processing Status": {
      select: {
        options: [
          { name: "Completed", color: "green" },
          { name: "Processing", color: "yellow" },
          { name: "Failed", color: "red" }
        ]
      }
    }
  });
}

// Add journal entry to Notion database
export async function addJournalEntryToNotion(
  notion: Client, 
  databaseId: string, 
  entry: {
    title: string;
    date: string;
    tags: string[];
    content: string;
    imageUrl?: string;
    processingStatus: string;
  }
) {
  const properties: any = {
    Title: {
      title: [
        {
          text: {
            content: entry.title
          }
        }
      ]
    },
    Date: {
      date: {
        start: entry.date
      }
    },
    Tags: {
      multi_select: entry.tags.map(tag => ({ name: tag }))
    },
    "Processing Status": {
      select: {
        name: entry.processingStatus === "completed" ? "Completed" : 
              entry.processingStatus === "processing" ? "Processing" : "Failed"
      }
    }
  };

  // Add photo if available
  if (entry.imageUrl) {
    properties.Photo = {
      files: [
        {
          type: "external",
          name: "Journal Photo",
          external: {
            url: entry.imageUrl
          }
        }
      ]
    };
  }

  // Create the page in the database
  const page = await notion.pages.create({
    parent: {
      database_id: databaseId
    },
    properties
  });

  // Add content as page blocks (rich text content)
  const blocks: any[] = [];

  // Add journal content as paragraph blocks
  if (entry.content) {
    // Split content into paragraphs and create blocks
    const paragraphs = entry.content.split('\n').filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: paragraph.trim()
                }
              }
            ]
          }
        });
      }
    }
  }

  // Add image if available
  if (entry.imageUrl) {
    console.log(`Adding image block to Notion page: ${entry.imageUrl}`);
    try {
      blocks.push({
        object: 'block',
        type: 'image',
        image: {
          type: 'external',
          external: {
            url: entry.imageUrl
          },
          caption: [
            {
              type: 'text',
              text: {
                content: 'Journal Entry Photo'
              }
            }
          ]
        }
      });
    } catch (imageError) {
      console.error(`Failed to add image block: ${imageError}`);
    }
  }

  // Add blocks to the page if we have any content
  if (blocks.length > 0) {
    try {
      console.log(`Adding ${blocks.length} blocks to Notion page ${page.id}`);
      await notion.blocks.children.append({
        block_id: page.id,
        children: blocks
      });
      console.log(`Successfully added blocks to Notion page`);
    } catch (blockError) {
      console.error(`Failed to add blocks to Notion page:`, blockError);
      // Try to add blocks one by one to identify which one fails
      for (let i = 0; i < blocks.length; i++) {
        try {
          await notion.blocks.children.append({
            block_id: page.id,
            children: [blocks[i]]
          });
          console.log(`Successfully added block ${i + 1}`);
        } catch (individualBlockError) {
          console.error(`Failed to add block ${i + 1}:`, individualBlockError);
        }
      }
    }
  }

  return page;
}

// Update existing Notion entry
export async function updateNotionEntry(
  notion: Client,
  pageId: string,
  updates: {
    content?: string;
    tags?: string[];
    processingStatus?: string;
  }
) {
  const properties: any = {};

  if (updates.tags) {
    properties.Tags = {
      multi_select: updates.tags.map(tag => ({ name: tag }))
    };
  }

  if (updates.processingStatus) {
    properties["Processing Status"] = {
      select: {
        name: updates.processingStatus === "completed" ? "Completed" : 
              updates.processingStatus === "processing" ? "Processing" : "Failed"
      }
    };
  }

  // Update page properties
  await notion.pages.update({
    page_id: pageId,
    properties
  });

  // Update page content if provided
  if (updates.content) {
    // Get existing blocks and replace content blocks
    const existingBlocks = await notion.blocks.children.list({
      block_id: pageId
    });

    // Delete existing content blocks (but keep images)
    for (const block of existingBlocks.results) {
      if ('type' in block && block.type === 'paragraph') {
        await notion.blocks.delete({
          block_id: block.id
        });
      }
    }

    // Add new content blocks
    const blocks: any[] = [];
    const paragraphs = updates.content.split('\n').filter(p => p.trim());
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim()) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: paragraph.trim()
                }
              }
            ]
          }
        });
      }
    }

    if (blocks.length > 0) {
      await notion.blocks.children.append({
        block_id: pageId,
        children: blocks
      });
    }
  }
}