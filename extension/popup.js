document.addEventListener("DOMContentLoaded", async () => {
  const elements = {
    tabCategorize: document.getElementById("tabCategorize"),
    tabSettings: document.getElementById("tabSettings"),
    categorizeTab: document.getElementById("categorizeTab"),
    settingsTab: document.getElementById("settingsTab"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    saveKey: document.getElementById("saveKey"),
    pageTitle: document.getElementById("pageTitle"),
    pageUrl: document.getElementById("pageUrl"),
    pageInfo: document.getElementById("pageInfo"),
    loadingState: document.getElementById("loadingState"),
    noApiKeyState: document.getElementById("noApiKeyState"),
    successState: document.getElementById("successState"),
    goToSettings: document.getElementById("goToSettings"),
    folderSelect: document.getElementById("folderSelect"),
    folderPath: document.getElementById("folderPath")
  };

  let currentBookmark = null;
  let autoCloseTimer = null;
  const AUTO_CLOSE_DELAY = 5000; // 5 seconds

  const hideAllStates = () => {
    elements.pageInfo.style.display = "none";
    elements.loadingState.style.display = "none";
    elements.noApiKeyState.style.display = "none";
    elements.successState.style.display = "none";
  };

  const switchTab = (tab) => {
    const isCategorize = tab === "categorize";
    elements.tabCategorize.classList.toggle("active", isCategorize);
    elements.tabSettings.classList.toggle("active", !isCategorize);
    elements.categorizeTab.classList.toggle("active", isCategorize);
    elements.settingsTab.classList.toggle("active", !isCategorize);
  };

  const showSuccess = (folderName) => {
    hideAllStates();
    clearAutoCloseTimer();
    elements.successState.style.display = "block";
    elements.successState.classList.add("fade-in");
    
    // Load folders into select dropdown
    loadFolderSelect(folderName);
    
    // Start auto-close timer
    startAutoCloseTimer();
  };

  const startAutoCloseTimer = () => {
    autoCloseTimer = setTimeout(() => {
      window.close();
    }, AUTO_CLOSE_DELAY);
  };

  const clearAutoCloseTimer = () => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  };

  const showError = (message) => {
    hideAllStates();
    elements.noApiKeyState.style.display = "block";
  };

  const showLoading = () => {
    hideAllStates();
    elements.pageInfo.style.display = "block";
    elements.loadingState.style.display = "block";
  };

  // Tab switching
  elements.tabCategorize.addEventListener("click", () => switchTab("categorize"));
  elements.tabSettings.addEventListener("click", () => switchTab("settings"));

  // Settings functionality with improved feedback
  elements.saveKey.addEventListener("click", () => {
    const apiKey = elements.apiKeyInput.value.trim();
    if (!apiKey) {
      elements.apiKeyInput.style.borderColor = "#ef4444";
      elements.apiKeyInput.focus();
      return;
    }
    
    elements.saveKey.textContent = "Saving...";
    elements.saveKey.disabled = true;
    
    chrome.storage.sync.set({ openai_key: apiKey }, () => {
      elements.saveKey.textContent = "Saved ✓";
      elements.saveKey.style.background = "#10b981";
      
      setTimeout(() => {
        elements.saveKey.textContent = "Save Configuration";
        elements.saveKey.style.background = "";
        elements.saveKey.disabled = false;
        switchTab("categorize");
        initializeCategorization();
      }, 1000);
    });
  });

  // Reset input border color on focus
  elements.apiKeyInput.addEventListener("input", () => {
    elements.apiKeyInput.style.borderColor = "";
  });

  // Go to settings link
  elements.goToSettings.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab("settings");
    elements.apiKeyInput.focus();
  });

  // Folder select dropdown functionality
  elements.folderSelect.addEventListener("change", (e) => {
    const selectedFolderId = e.target.value;
    const selectedOption = e.target.options[e.target.selectedIndex];
    const selectedFolderName = selectedOption.text;
    
    // Update the path text display - we need to get the full path from the selected option
    // Find the matching folder from our stored list to get the full path
    chrome.runtime.sendMessage({ type: "getFolders" }, (response) => {
      if (response && response.folders) {
        const selectedFolder = response.folders.find(folder => folder.id === selectedFolderId);
        if (selectedFolder) {
          const pathSpan = elements.folderPath.querySelector('.path-text');
          if (pathSpan) {
            let displayPath = selectedFolder.fullPath;
            if (displayPath.startsWith('Bookmarks Bar/')) {
              displayPath = displayPath.replace('Bookmarks Bar/', '');
            } else if (displayPath === 'Bookmarks Bar') {
              displayPath = 'Root';
            }
            pathSpan.textContent = displayPath;
          }
        }
      }
    });
    
    if (selectedFolderId && currentBookmark) {
      clearAutoCloseTimer(); // Pause auto-close during folder change
      moveBookmarkToFolder(selectedFolderId, selectedFolderName);
    }
  });

  const showFolderSelection = async () => {
    if (!currentBookmark) {
      console.error("No current bookmark available");
      return;
    }
    
    hideAllStates();
    elements.selectionPageTitle.textContent = currentBookmark.title;
    elements.selectionPageUrl.textContent = currentBookmark.url;
    elements.folderSelectionState.style.display = "block";
    
    // Load folders
    chrome.runtime.sendMessage({ type: "getFolders" }, (response) => {
      if (response && response.folders) {
        renderFolderList(response.folders);
      } else {
        console.error("Failed to load folders:", response);
        showError("Failed to load folders");
      }
    });
  };

  const renderFolderList = (folders) => {
    elements.folderList.innerHTML = "";
    
    folders.forEach((folder, index) => {
      const folderItem = document.createElement("div");
      folderItem.className = "folder-item";
      folderItem.style.animationDelay = `${index * 0.05}s`;
      folderItem.classList.add("fade-in");
      
      // Clean up folder path and calculate nesting level
      let displayPath = folder.fullPath;
      let nestLevel = 0;
      
      if (displayPath.startsWith('Bookmarks Bar/')) {
        displayPath = displayPath.replace('Bookmarks Bar/', '');
        // Count slashes to determine nesting level
        nestLevel = (displayPath.match(/\//g) || []).length;
        // Show just the folder name, not full path
        displayPath = displayPath.split('/').pop();
      } else if (displayPath === 'Bookmarks Bar') {
        displayPath = 'Bookmarks Bar';
        nestLevel = 0;
      }
      
      // Apply indentation based on nesting level
      const indentPx = nestLevel * 20;
      folderItem.style.paddingLeft = `${16 + indentPx}px`;
      
      folderItem.innerHTML = `
        <div class="folder-path">${displayPath}</div>
      `;
      
      folderItem.addEventListener("click", () => {
        // Remove previous selection
        elements.folderList.querySelectorAll(".folder-item").forEach(item => {
          item.classList.remove("selected");
        });
        
        // Select current item with haptic feedback
        folderItem.classList.add("selected");
        
        // Move bookmark after short delay for visual feedback
        setTimeout(() => {
          moveBookmarkToFolder(folder.id, folder.fullPath);
        }, 400);
      });
      
      elements.folderList.appendChild(folderItem);
    });
  };

  const loadFolderSelect = (currentFolderName) => {
    // Load folders into select dropdown
    chrome.runtime.sendMessage({ type: "getFolders" }, (response) => {
      if (response && response.folders) {
        populateFolderSelect(response.folders, currentFolderName);
      } else {
        console.error("Failed to load folders:", response);
      }
    });
  };

  const populateFolderSelect = (folders, selectedFolderName) => {
    elements.folderSelect.innerHTML = "";
    let selectedFolder = null;
    
    folders.forEach(folder => {
      // Clean up folder path for display
      let displayPath = folder.fullPath;
      let nestLevel = 0;
      
      if (displayPath.startsWith('Bookmarks Bar/')) {
        displayPath = displayPath.replace('Bookmarks Bar/', '');
        nestLevel = (displayPath.match(/\//g) || []).length;
        displayPath = displayPath.split('/').pop();
      } else if (displayPath === 'Bookmarks Bar') {
        displayPath = 'Bookmarks Bar';
        nestLevel = 0;
      }
      
      // Create option with better hierarchy indicators
      const option = document.createElement("option");
      option.value = folder.id;
      
      let prefix = '';
      if (nestLevel === 0) {
        prefix = displayPath;
      } else {
        // Use │ and └ characters for better tree visualization
        const indent = '    '.repeat(nestLevel - 1);
        prefix = indent + '└─ ' + displayPath;
      }
      
      option.textContent = prefix;
      
      // Select the current folder and store it for path display
      if (folder.fullPath === selectedFolderName || displayPath === selectedFolderName) {
        option.selected = true;
        selectedFolder = folder;
      }
      
      elements.folderSelect.appendChild(option);
    });
    
    // Set the full path text
    if (selectedFolder) {
      const pathSpan = elements.folderPath.querySelector('.path-text');
      if (pathSpan) {
        let displayPath = selectedFolder.fullPath;
        if (displayPath.startsWith('Bookmarks Bar/')) {
          displayPath = displayPath.replace('Bookmarks Bar/', '');
        } else if (displayPath === 'Bookmarks Bar') {
          displayPath = 'Root';
        }
        pathSpan.textContent = displayPath;
      }
    }
  };

  const moveBookmarkToFolder = (folderId, folderName) => {
    console.log("Moving bookmark to folder:", folderId, folderName);
    
    chrome.runtime.sendMessage({
      type: "moveBookmark",
      url: currentBookmark.url,
      title: currentBookmark.title,
      folderId: folderId
    }, (response) => {
      console.log("Move bookmark response:", response);
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        showError("Failed to move bookmark");
        return;
      }
      
      if (response && response.success) {
        // Restart auto-close timer after successful move
        startAutoCloseTimer();
      } else {
        console.error("Move bookmark failed:", response);
        showError(response?.error || "Failed to move bookmark");
      }
    });
  };

  const initializeCategorization = async () => {
    try {
      const { openai_key } = await chrome.storage.sync.get("openai_key");
      
      if (!openai_key) {
        showError();
        return;
      }

      // Load existing API key into settings
      elements.apiKeyInput.value = openai_key;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Store current bookmark info
      currentBookmark = {
        title: tab.title,
        url: tab.url
      };
      
      // Show page info and loading state
      elements.pageTitle.textContent = tab.title;
      elements.pageUrl.textContent = tab.url;
      showLoading();

      // Execute script to get page content
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          content: document.body.innerText.slice(0, 2000),
          meta: document.querySelector('meta[name="description"]')?.content || ''
        })
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("Script execution failed:", chrome.runtime.lastError);
          showError("Failed to analyze page content");
          return;
        }

        if (!results || !results[0] || !results[0].result) {
          console.error("No results from script execution:", results);
          showError("Failed to analyze page content");
          return;
        }

        const { content, meta } = results[0].result;
        
        // Send categorization request
        chrome.runtime.sendMessage({
          type: "categorize",
          url: tab.url,
          title: tab.title,
          content,
          meta
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Categorization failed:", chrome.runtime.lastError);
            showError("Categorization failed");
            return;
          }
          
          if (response && response.error) {
            console.error("Categorization error:", response.error);
            showError(response.error);
          } else if (response && response.folder) {
            showSuccess(response.folder);
          } else {
            console.error("Invalid categorization response:", response);
            showError("Could not categorize bookmark");
          }
        });
      });
    } catch (error) {
      console.error("Initialization error:", error);
      showError("An error occurred");
    }
  };

  // Initialize the extension
  await initializeCategorization();
});