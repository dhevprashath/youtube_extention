# YouTube Video Summarizer Extension

A Chrome extension that uses Google's Gemini AI to generate structured summaries of YouTube videos from their transcripts.

## Features

- 🎥 Automatically extracts video metadata (title, channel, duration, URL)
- 📝 Extracts video transcripts automatically
- 🤖 Uses Gemini AI to generate comprehensive summaries
- 📊 Structured JSON output with:
  - Short and long summaries
  - Key points with timestamps
  - Section timestamps
  - FAQ items
  - Action items
  - SEO suggestions (title, tags, description)
- 🔒 Secure API key storage
- 🔄 Fallback summary generation if API fails

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/dhevprashath/youtube_extention.git
cd youtube_extention
```

### 2. Get Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

### 3. Configure API Key

**Option A: Set via Extension Options (Recommended)**
1. Load the extension in Chrome (see step 4)
2. Right-click the extension icon → "Options"
3. Paste your API key and save

**Option B: Set in Code (Not Recommended for Production)**
1. Open `background.js`
2. Find the line: `let GEMINI_API_KEY = '';`
3. Replace with: `let GEMINI_API_KEY = 'YOUR_API_KEY_HERE';`
4. **⚠️ Never commit this file with your API key to GitHub!**

### 4. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the folder containing this extension

## Usage

1. Navigate to any YouTube video page
2. **Open the transcript panel manually:**
   - Click the "⋯" (three dots) menu below the video
   - Select "Show transcript"
   - Wait for the transcript panel to appear
3. Click the extension icon in your Chrome toolbar
4. Click "Generate Summary"
5. The extension will:
   - Extract video information
   - Extract the transcript
   - Send the data to Gemini AI for summarization
   - Display the results in a structured format

### Alternative: Paste YouTube URL

1. Click the extension icon
2. Paste a YouTube URL in the input field
3. Click "Load Video"
4. Open the transcript panel on the loaded video
5. Click "Generate Summary"

## Viewing Summaries

The extension displays summaries in different tabs:
- **Summary**: Short and detailed summaries
- **Key Points**: Main points with timestamps
- **Timestamps**: Major sections with timestamps
- **FAQ**: Frequently asked questions and answers
- **JSON**: Complete JSON output (can be copied)

## Output Format

The extension generates JSON in this exact format:

```json
{
  "error": null,
  "meta": {
    "title": "Video Title",
    "channel": "Channel Name",
    "url": "https://youtube.com/watch?v=...",
    "duration_seconds": 600
  },
  "summary_short": "Brief 2-3 sentence summary",
  "summary_long": "Detailed paragraph summary",
  "key_points": [
    {"time": "00:00", "point": "Key point description"}
  ],
  "timestamps": [
    {"time": "00:00", "label": "Section name"}
  ],
  "faq": [
    {"q": "Question", "a": "Answer"}
  ],
  "action_items": [
    "Actionable item 1",
    "Actionable item 2"
  ],
  "suggested_title": "SEO-optimized title",
  "suggested_tags": ["tag1", "tag2"],
  "suggested_description": "SEO-optimized description"
}
```

## Troubleshooting

### Transcript not found
- **Solution**: Make sure you've manually opened the transcript panel on YouTube first
- Click "⋯" → "Show transcript" below the video
- Wait for the panel to load before clicking "Generate Summary"

### API errors
- **Check**: Verify your API key is set correctly
- **Check**: Ensure you have internet connection
- **Check**: Verify the API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)

### Extension not working
- **Check**: Make sure you're on a YouTube video page (URL contains `/watch`)
- **Check**: Reload the extension in `chrome://extensions/`
- **Check**: Open browser console (F12) for error messages

### Summary shows "N/A" or empty
- **Check**: Transcript must be open on YouTube
- **Check**: Browser console for error messages
- **Note**: Extension will use fallback summary if API fails

## Security Notes

- ⚠️ **Never commit your API key to GitHub**
- The `.gitignore` file is configured to prevent accidental commits
- Use Chrome storage sync for API key (recommended)
- Or use environment variables if building with tools

## Development

### Project Structure

```
youtube_extention/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (API calls)
├── content.js             # Content script (transcript extraction)
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── popup.css             # Popup styling
├── images/
│   └── icon.png          # Extension icon
├── README.md             # This file
└── .gitignore           # Git ignore rules
```

### API Key Management

The extension supports multiple ways to set the API key:

1. **Chrome Storage Sync** (Recommended)
   - Set via extension options
   - Synced across devices
   - More secure

2. **Code Configuration** (Development only)
   - Edit `background.js`
   - ⚠️ Never commit to Git

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

If you encounter issues:
1. Check the browser console (F12) for errors
2. Verify your API key is correct
3. Ensure the transcript panel is open on YouTube
4. Open an issue on GitHub with error details

## Credits

- Uses [Google Gemini AI](https://ai.google.dev/) for summarization
- Built for Chrome/Edge browsers
