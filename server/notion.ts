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

    console.log(`Found ${response.results.length} blocks in Notion page`);

    // Look for existing journal database
    for (const block of response.results) {
      if (block.object === 'block' && (block as any).type === "child_database") {
        try {
          const databaseInfo = await notion.databases.retrieve({
            database_id: block.id,
          });

          console.log(`Found database: ${JSON.stringify((databaseInfo as any).title)}`);
          console.log(`Database URL: https://notion.so/${databaseInfo.id.replace(/-/g, '')}`);

          // Return the first database we find for now
          console.log(`Using existing database: ${databaseInfo.id}`);
          return databaseInfo.id;
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
    // First, get the database schema to understand what properties exist
    const database = await notion.databases.retrieve({ database_id: databaseId });
    const existingProperties = (database as any).properties || {};
    
    console.log('Available database properties:', Object.keys(existingProperties));

    // Create database properties - only use existing properties
    const properties: any = {};
    
    // Always set Title (required for all databases)
    if (existingProperties.Title || existingProperties.Name) {
      const titleProp = existingProperties.Title ? 'Title' : 'Name';
      properties[titleProp] = {
        title: [
          {
            text: {
              content: data.title
            }
          }
        ]
      };
    }

    // Add other properties only if they exist in the database
    if (existingProperties.Tags && data.tags && data.tags.length > 0) {
      properties.Tags = {
        multi_select: data.tags.map(tag => ({ name: tag }))
      };
    }

    if (existingProperties.Sentiment && data.sentiment) {
      properties.Sentiment = {
        select: {
          name: data.sentiment
        }
      };
    }

    if (existingProperties.Date && data.date) {
      properties.Date = {
        date: {
          start: data.date
        }
      };
    }

    if (existingProperties.Status) {
      properties.Status = {
        select: {
          name: "Processed"
        }
      };
    }

    console.log('Creating page with properties:', Object.keys(properties));

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

    // Add the summary and full transcribed text as page content
    const children = [];
    
    // Add summary as a heading and paragraph
    if (data.summary) {
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [
            {
              type: "text",
              text: {
                content: "Summary"
              }
            }
          ]
        }
      });
      
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: data.summary
              }
            }
          ]
        }
      });
    }
    
    // Add full transcribed text
    if (data.content) {
      children.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [
            {
              type: "text",
              text: {
                content: "Full Text"
              }
            }
          ]
        }
      });
      
      // Split long content into chunks for Notion's block limits
      const maxBlockLength = 2000;
      const contentChunks = data.content.match(new RegExp(`.{1,${maxBlockLength}}`, 'g')) || [data.content];
      
      contentChunks.forEach(chunk => {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: chunk
                }
              }
            ]
          }
        });
      });
    }
    
    if (children.length > 0) {
      pageData.children = children;
    }

    const page = await notion.pages.create(pageData);
    
    console.log(`Journal entry synced to Notion: https://notion.so/${page.id.replace(/-/g, '')}`);

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