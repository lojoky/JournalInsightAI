import { Client } from "@notionhq/client";

// Initialize Notion client (will be null if not configured)
let notion: Client | null = null;
let NOTION_PAGE_ID: string | null = null;

export function initializeNotion(integrationSecret: string, pageUrl: string) {
  try {
    notion = new Client({
      auth: integrationSecret,
    });
    
    // Extract the page ID from the Notion page URL
    const match = pageUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
    if (match && match[1]) {
      NOTION_PAGE_ID = match[1];
      return true;
    }
    
    throw new Error("Invalid Notion page URL format");
  } catch (error) {
    console.error("Failed to initialize Notion:", error);
    notion = null;
    NOTION_PAGE_ID = null;
    return false;
  }
}

export function isNotionConfigured(): boolean {
  return notion !== null && NOTION_PAGE_ID !== null;
}

// Find or create the journal entries database
export async function setupJournalDatabase() {
  if (!notion || !NOTION_PAGE_ID) {
    throw new Error("Notion not configured");
  }

  try {
    // Query all child blocks in the specified page
    const response = await notion.blocks.children.list({
      block_id: NOTION_PAGE_ID,
    });

    // Look for existing journal database
    for (const block of response.results) {
      if (block.object === 'block' && (block as any).type === "child_database") {
        try {
          const databaseInfo = await notion.databases.retrieve({
            database_id: block.id,
          });

          // Check if this is our journal database
          if (databaseInfo.object === 'database' && (databaseInfo as any).title) {
            const title = (databaseInfo as any).title;
            if (Array.isArray(title) && title.length > 0) {
              const dbTitle = title[0]?.plain_text?.toLowerCase() || "";
              if (dbTitle.includes("journal") || dbTitle.includes("entries")) {
                return databaseInfo.id;
              }
            }
          }
        } catch (error) {
          console.error(`Error checking database ${block.id}:`, error);
        }
      }
    }

    // Create new journal database if none exists
    const newDatabase = await notion.databases.create({
      parent: {
        type: "page_id",
        page_id: NOTION_PAGE_ID
      },
      title: [
        {
          type: "text",
          text: {
            content: "Journal Entries"
          }
        }
      ],
      properties: {
        Title: {
          title: {}
        },
        Summary: {
          rich_text: {}
        },
        Date: {
          date: {}
        },
        Tags: {
          multi_select: {
            options: [
              { name: "faith", color: "blue" },
              { name: "career", color: "green" },
              { name: "relationships", color: "pink" },
              { name: "gratitude", color: "yellow" },
              { name: "reflection", color: "gray" },
              { name: "personal", color: "purple" },
              { name: "family", color: "red" }
            ]
          }
        },
        Sentiment: {
          select: {
            options: [
              { name: "Positive", color: "green" },
              { name: "Neutral", color: "gray" },
              { name: "Concern", color: "yellow" },
              { name: "Negative", color: "red" }
            ]
          }
        },
        Status: {
          select: {
            options: [
              { name: "Processed", color: "green" },
              { name: "Pending", color: "yellow" },
              { name: "Failed", color: "red" }
            ]
          }
        }
      }
    });

    return newDatabase.id;
  } catch (error) {
    console.error("Error setting up journal database:", error);
    throw error;
  }
}

// Simplified interface for journal entry data
interface NotionJournalData {
  title: string;
  content: string;
  summary: string;
  imageUrl: string;
  tags?: string[];
  sentiment?: string;
  date?: string;
}

// Create a journal entry in Notion with image cover and content
export async function createNotionJournalEntry(
  databaseId: string,
  data: NotionJournalData
) {
  if (!notion) {
    throw new Error("Notion not configured");
  }

  try {
    // Create database properties
    const properties: any = {
      Title: {
        title: [
          {
            text: {
              content: data.title
            }
          }
        ]
      },
      Summary: {
        rich_text: [
          {
            text: {
              content: data.summary
            }
          }
        ]
      },
      Date: {
        date: {
          start: data.date || new Date().toISOString().split('T')[0]
        }
      },
      Status: {
        select: {
          name: "Processed"
        }
      }
    };

    // Add tags if provided
    if (data.tags && data.tags.length > 0) {
      properties.Tags = {
        multi_select: data.tags.map(tag => ({ name: tag }))
      };
    }

    // Add sentiment if provided
    if (data.sentiment) {
      properties.Sentiment = {
        select: {
          name: data.sentiment
        }
      };
    }

    // Create the page with cover image and content
    const pageData: any = {
      parent: {
        database_id: databaseId
      },
      properties,
      cover: {
        type: "external",
        external: {
          url: data.imageUrl
        }
      }
    };

    // Add the transcribed text as page content (children blocks)
    if (data.content) {
      pageData.children = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: data.content
                }
              }
            ]
          }
        }
      ];
    }

    const page = await notion.pages.create(pageData);

    return page.id;
  } catch (error) {
    console.error("Error creating Notion journal entry:", error);
    throw error;
  }
}

// Sync journal entry to Notion with enhanced data
export async function syncJournalToNotion(
  integrationSecret: string,
  pageUrl: string,
  data: NotionJournalData
): Promise<string | null> {
  try {
    // Initialize Notion for this user
    if (!initializeNotion(integrationSecret, pageUrl)) {
      throw new Error("Failed to initialize Notion");
    }

    // Setup or find journal database
    const databaseId = await setupJournalDatabase();
    
    // Create the journal entry
    const pageId = await createNotionJournalEntry(databaseId, data);

    return pageId;
  } catch (error) {
    console.error("Error syncing to Notion:", error);
    return null;
  }
}