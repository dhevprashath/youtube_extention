# Setup Guide

## Quick Start

1. **Get Your Gemini API Key**
   - Visit: https://makersuite.google.com/app/apikey
   - Sign in with Google
   - Click "Create API Key"
   - Copy your key

2. **Set the API Key**

   **Option 1: Via Chrome Storage (Recommended)**
   - Load the extension in Chrome
   - Open browser console (F12)
   - Run: `chrome.storage.sync.set({geminiApiKey: 'YOUR_API_KEY_HERE'})`
   - Reload the extension

   **Option 2: Direct in Code (Development Only)**
   - Open `background.js`
   - Find: `let GEMINI_API_KEY = '';`
   - Change to: `let GEMINI_API_KEY = 'YOUR_API_KEY_HERE';`
   - ⚠️ **Never commit this change to Git!**

3. **Load Extension**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select this folder

4. **Use the Extension**
   - Go to a YouTube video
   - Open transcript (⋯ → Show transcript)
   - Click extension icon
   - Click "Generate Summary"

## Troubleshooting

**"API key not configured" error:**
- Make sure you set the API key using one of the methods above
- Check browser console for errors

**"No transcript found":**
- You must manually open the transcript panel on YouTube first
- Click the three dots menu below the video
- Select "Show transcript"

