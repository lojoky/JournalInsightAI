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
    Content: {
      rich_text: {}
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
    Content: {
      rich_text: [
        {
          text: {
            content: entry.content || ""
          }
        }
      ]
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

  return await notion.pages.create({
    parent: {
      database_id: databaseId
    },
    properties
  });
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

  if (updates.content) {
    properties.Content = {
      rich_text: [
        {
          text: {
            content: updates.content
          }
        }
      ]
    };
  }

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

  return await notion.pages.update({
    page_id: pageId,
    properties
  });
}