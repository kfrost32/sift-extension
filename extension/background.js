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
      sendResponse({ error: "No API key configured" });
      return;
    }

    // Validate API key format
    if (!openai_key.startsWith('sk-') || openai_key.length < 20) {
      sendResponse({ error: "Invalid API key format" });
      return;
    }

    // Sanitize inputs to prevent potential issues
    const sanitizedTitle = (title || 'Unknown').slice(0, 200).replace(/[<>]/g, '');
    const sanitizedMeta = (meta || 'None').slice(0, 300).replace(/[<>]/g, '');
    const sanitizedContent = (content || 'None').slice(0, 2000).replace(/[<>]/g, '');
    
    const prompt = `Page Title: ${sanitizedTitle}\nMeta Description: ${sanitizedMeta}\nContent: ${sanitizedContent}\n\nFolders:\n${folderList}\n\nWhich folder path best matches this content? Reply with only the exact folder path.`;

    let response;
    try {
      const requestBody = {
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4
      };
      
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openai_key}`
        },
        body: JSON.stringify(requestBody)
      });
    } catch (fetchError) {
      sendResponse({ error: "Network error occurred" });
      return;
    }

    try {
      if (!response) {
        sendResponse({ error: "Network error: No response received" });
        return;
      }

      if (!response.ok) {
        sendResponse({ error: `API request failed with status ${response.status}` });
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        sendResponse({ error: "Failed to parse API response" });
        return;
      }
    
      if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
        sendResponse({ error: "Invalid API response format" });
        return;
      }
    
    // Sanitize AI response
    const aiPath = data.choices[0].message.content.trim().slice(0, 500);
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
      sendResponse({ error: "Error processing response" });
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