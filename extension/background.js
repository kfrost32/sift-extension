const DEFAULT_MODEL = "gpt-4";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "categorize") {
    handleCategorization(msg.url, msg.title, msg.content, msg.meta, sendResponse);
    return true; // Keep the message channel open
  } else if (msg.type === "getFolders") {
    getFolders(sendResponse);
    return true;
  } else if (msg.type === "moveBookmark") {
    moveBookmark(msg.url, msg.title, msg.folderId, sendResponse);
    return true;
  }
});

async function handleCategorization(url, title, content, meta, sendResponse) {
  const allFolders = await getAllBookmarkFolders();
  const folderPaths = flattenBookmarkTree(allFolders);
  const folderList = folderPaths.map(f => f.fullPath).join("\n");

  chrome.storage.sync.get("openai_key", async ({ openai_key }) => {
    if (!openai_key) {
      console.error("No OpenAI API key found");
      sendResponse({ error: "No API key configured" });
      return;
    }

    console.log("Building prompt with:", { title, meta: meta?.substring(0, 50), content: content?.substring(0, 50), folderCount: folderPaths.length });
    const prompt = `Page Title: ${title || 'Unknown'}\nMeta Description: ${meta || 'None'}\nContent: ${content || 'None'}\n\nFolders:\n${folderList}\n\nWhich folder path best matches this content? Reply with only the exact folder path.`;

    let response;
    try {
      console.log("Making OpenAI API request...");
      const requestBody = {
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4
      };
      console.log("Request body:", { model: requestBody.model, messageLength: requestBody.messages[0]?.content?.length });
      
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openai_key}`
        },
        body: JSON.stringify(requestBody)
      });
    } catch (fetchError) {
      console.error("Network error during fetch:", fetchError);
      sendResponse({ error: `Network error: ${fetchError.message}` });
      return;
    }

    try {
      if (!response) {
        console.error("OpenAI API request failed: No response received");
        sendResponse({ error: "Network error: No response received" });
        return;
      }

      if (!response.ok) {
        console.error("OpenAI API request failed:", response.status, response.statusText);
        sendResponse({ error: `API request failed: ${response.status}` });
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse OpenAI API response:", parseError);
        sendResponse({ error: "Failed to parse API response" });
        return;
      }
    
      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Invalid OpenAI API response:", data);
        sendResponse({ error: "Invalid API response" });
        return;
      }
    
    const aiPath = data.choices[0].message.content.trim();
    const bestMatch = folderPaths.find(f => f.fullPath === aiPath);

    if (bestMatch) {
      // prevent duplicate
      const existing = await chrome.bookmarks.search({ title });
      const alreadyBookmarked = existing.some(b => b.url === url && b.parentId === bestMatch.id);
      if (!alreadyBookmarked) {
        await chrome.bookmarks.create({
          parentId: bestMatch.id,
          title,
          url
        });
      }
      sendResponse({ folder: aiPath });
    } else {
      sendResponse({ folder: "Unmatched" });
    }
    
    } catch (processingError) {
      console.error("Response processing error:", processingError);
      sendResponse({ error: processingError.message });
    }
  });
}

async function getAllBookmarkFolders() {
  return new Promise(resolve => {
    chrome.bookmarks.getTree(resolve);
  });
}

function flattenBookmarkTree(nodes, path = "", result = []) {
  for (const node of nodes) {
    if (!node.url) {
      const fullPath = path ? `${path}/${node.title}` : node.title;
      result.push({ id: node.id, fullPath });
      if (node.children) {
        flattenBookmarkTree(node.children, fullPath, result);
      }
    }
  }
  return result;
}

async function getFolders(sendResponse) {
  try {
    const allFolders = await getAllBookmarkFolders();
    const folderPaths = flattenBookmarkTree(allFolders);
    sendResponse({ folders: folderPaths });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function moveBookmark(url, title, newFolderId, sendResponse) {
  try {
    // Find existing bookmark
    const existing = await chrome.bookmarks.search({ title });
    const bookmark = existing.find(b => b.url === url);
    
    if (bookmark) {
      // Move existing bookmark
      await chrome.bookmarks.move(bookmark.id, { parentId: newFolderId });
    } else {
      // Create new bookmark in the specified folder
      await chrome.bookmarks.create({
        parentId: newFolderId,
        title,
        url
      });
    }
    
    // Get folder name for response
    const folder = await chrome.bookmarks.get(newFolderId);
    const allFolders = await getAllBookmarkFolders();
    const folderPaths = flattenBookmarkTree(allFolders);
    const folderPath = folderPaths.find(f => f.id === newFolderId);
    
    let folderName = "Unknown Folder";
    if (folderPath) {
      folderName = folderPath.fullPath;
    } else if (folder && folder.length > 0) {
      folderName = folder[0].title;
    }
    
    sendResponse({ 
      success: true, 
      folder: folderName
    });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}