# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains the **marketing/demo website** for Sift, a Chrome browser extension that intelligently categorizes bookmarks using AI. The primary purpose is the static demonstration site (`index.html`), with the extension files included for context and development reference.

## Architecture

- **Primary Focus - Demo Website** (`index.html`): Interactive marketing site with animated demos showcasing extension functionality
- **Extension Reference** (`extension/` folder): Complete Chrome extension implementation included for development context
  - **Background Service Worker** (`extension/background.js`): Handles AI categorization, OpenAI API calls, and bookmark management  
  - **Popup Interface** (`extension/popup.html` + `extension/popup.js`): User interface for configuration and bookmark categorization

## Key Components

### Demo Website (`index.html`)
- **Interactive Demo**: Animated browser window showing extension functionality
- **Scenario Cycling**: Multiple bookmark examples (React docs, trail running, fonts, books, recipes)
- **Apple-style Design**: Modern marketing page with glassmorphism effects
- **FAQ Section**: Installation instructions and usage information
- **Background Animations**: Smooth transitions between demo scenarios

### Extension Reference (`extension/` folder)
The extension files are included for development context:

#### Background Service Worker (`extension/background.js`)
- **Main Functions**:
  - `handleCategorization()`: Processes page content through OpenAI API to suggest folders
  - `getFolders()`: Retrieves and flattens the user's bookmark folder structure  
  - `moveBookmark()`: Handles bookmark creation and folder management
- **API Integration**: Uses OpenAI GPT-4 model with user-provided API keys

#### Popup Interface (`extension/popup.js`)  
- **Dual-tab Interface**: Categorize tab (main functionality) and Settings tab (API key configuration)
- **State Management**: Loading, success, error, and folder selection states
- **Content Analysis**: Extracts page content via Chrome scripting API

## Development Focus

### Demo Website Development
The primary development focus is on the marketing website (`index.html`):

- **Demo Scenarios**: Modify the `demoScenarios` array in the JavaScript to add/update bookmark examples
- **Styling**: Apple-inspired design with CSS custom properties, glassmorphism effects, and smooth animations
- **Animation System**: Cycling demo states with fade transitions between scenarios
- **Background Images**: Various scenario images (alps.jpg, fonts.jpg, books.jpg, etc.) for visual context

### Website Structure
- **Header**: Logo, title, and subtitle with animated background
- **Demo Section**: Interactive browser window showing extension in action
- **FAQ Section**: Installation instructions and common questions
- **Footer**: Links and attribution

## Common Development Tasks

### Adding New Demo Scenarios
1. Add new scenario object to `demoScenarios` array in `index.html:645-681`
2. Include: title, url, suggested folder, dropdown options, and background class
3. Add corresponding background image and CSS class if needed

### Updating Styling
- **CSS Variables**: Defined in `:root` for consistent theming
- **Animations**: `@keyframes` definitions for smooth transitions
- **Responsive**: Consider mobile viewport for demo window sizing

### Testing the Demo
- Open `index.html` in browser to see animated demo
- Demo cycles through scenarios automatically
- Check transitions and timing adjustments

## File Structure

```
/
├── index.html          # PRIMARY: Demo/marketing website
├── extension/          # Reference: Chrome extension implementation
│   ├── manifest.json   # Extension configuration
│   ├── background.js   # Service worker (AI logic)
│   ├── popup.html      # Extension popup UI
│   ├── popup.js        # Popup functionality
│   └── icon.png        # Extension icon
└── *.jpg               # Demo scenario background images
    ├── alps.jpg        # Trail running scenario
    ├── fonts.jpg       # Typography/fonts scenario  
    ├── books.jpg       # Reading/books scenario
    ├── portfolio.jpg   # Design portfolio scenario
    └── recipes.jpg     # Cooking/recipes scenario
```

## Extension Development (Reference Only)

The extension files are included for context but the primary focus is the demo website. For extension development:

### Modifying AI Prompts
- Edit prompt construction in `extension/background.js:29` in `handleCategorization` function

### Updating Extension UI
- Modify popup states in `extension/popup.js`: `showLoading()`, `showSuccess()`, `showError()`
- Update CSS styling in `extension/popup.html` embedded styles

### Testing Extension
1. Load unpacked extension from `extension/` folder in Chrome developer mode
2. Configure OpenAI API key in Settings tab
3. Test on various webpages