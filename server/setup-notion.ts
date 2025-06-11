import { createNotionClient, extractPageIdFromUrl, createJournalDatabase } from "./notion";

// Environment variables validation
if (!process.env.NOTION_INTEGRATION_SECRET) {
    throw new Error("NOTION_INTEGRATION_SECRET is not defined. Please add it to your environment variables.");
}

if (!process.env.NOTION_PAGE_URL) {
    throw new Error("NOTION_PAGE_URL is not defined. Please add it to your environment variables.");
}

async function setupNotionDatabases() {
    try {
        console.log("Setting up Notion databases...");
        
        const notion = createNotionClient(process.env.NOTION_INTEGRATION_SECRET!);
        const pageId = extractPageIdFromUrl(process.env.NOTION_PAGE_URL!);
        
        // Create the journal database
        const journalDb = await createJournalDatabase(notion, pageId);
        console.log(`Journal database created/found: ${journalDb.id}`);
        
        console.log("Notion setup complete!");
        return journalDb;
    } catch (error) {
        console.error("Setup failed:", error);
        throw error;
    }
}

// Run the setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    setupNotionDatabases()
        .then(() => {
            console.log("Setup complete!");
            process.exit(0);
        })
        .catch(error => {
            console.error("Setup failed:", error);
            process.exit(1);
        });
}

export { setupNotionDatabases };