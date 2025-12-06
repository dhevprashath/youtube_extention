// Content script to extract video information from YouTube page

function extractVideoData() {
  const data = {
    video_title: null,
    channel_name: null,
    video_url: window.location.href,
    duration_seconds: 0,
    transcript: null
  };

  // Extract video title
  const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string, h1[class*="title"]');
  if (titleElement) {
    data.video_title = titleElement.textContent.trim();
  }

  // Extract channel name
  const channelElement = document.querySelector('#channel-name a, ytd-channel-name a, #owner-sub-count a');
  if (channelElement) {
    data.channel_name = channelElement.textContent.trim();
  }

  // Extract duration
  const durationElement = document.querySelector('.ytp-time-duration, video');
  if (durationElement) {
    const durationText = durationElement.textContent || durationElement.duration;
    if (durationText) {
      data.duration_seconds = parseDuration(durationText);
    }
  }

  // Try to get video element for duration
  const videoElement = document.querySelector('video');
  if (videoElement && videoElement.duration) {
    data.duration_seconds = Math.floor(videoElement.duration);
  }

  return data;
}

function parseDuration(durationStr) {
  if (typeof durationStr === 'number') {
    return Math.floor(durationStr);
  }
  
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }
  
  if (request.action === 'extractVideoData') {
    const videoData = extractVideoData();
    sendResponse(videoData);
    return true;
  }
  
  return true;
});

// Function to check if transcript is available
function checkTranscriptAvailable() {
  // Check for transcript button
  const transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');
  return transcriptButton !== null;
}

// Expose function to get transcript if available
async function getTranscript() {
  try {
    console.log('Attempting to extract transcript...');
    
    // Multiple selectors for transcript button
    const transcriptButtonSelectors = [
      'button[aria-label*="transcript" i]',
      'button[aria-label*="Show transcript" i]',
      'button[aria-label*="Transcript" i]',
      'ytd-menu-renderer button[aria-label*="transcript" i]',
      '#button[aria-label*="transcript" i]',
      'button.ytd-menu-renderer[aria-label*="transcript" i]'
    ];
    
    let transcriptButton = null;
    for (const selector of transcriptButtonSelectors) {
      transcriptButton = document.querySelector(selector);
      if (transcriptButton) {
        console.log('Found transcript button with selector:', selector);
        break;
      }
    }
    
    // If button found, try to open transcript panel
    if (transcriptButton) {
      // Check if already open
      let transcriptPanel = document.querySelector('ytd-transcript-renderer, ytd-transcript-body-renderer, #transcript');
      
      if (!transcriptPanel) {
        console.log('Clicking transcript button...');
        transcriptButton.click();
        // Wait longer for panel to open
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try again to find panel
        transcriptPanel = document.querySelector('ytd-transcript-renderer, ytd-transcript-body-renderer, #transcript');
      }
      
      if (transcriptPanel) {
        console.log('Transcript panel found');
      }
    }
    
    // Try multiple selectors for transcript segments
    const segmentSelectors = [
      'ytd-transcript-segment-renderer',
      'ytd-transcript-body-renderer ytd-transcript-segment-renderer',
      '.segment-text',
      '[class*="segment"]',
      'ytd-transcript-body-renderer div[class*="segment"]'
    ];
    
    let transcriptSegments = [];
    for (const selector of segmentSelectors) {
      transcriptSegments = document.querySelectorAll(selector);
      if (transcriptSegments.length > 0) {
        console.log(`Found ${transcriptSegments.length} segments with selector:`, selector);
        break;
      }
    }
    
    if (transcriptSegments.length > 0) {
      console.log('Processing', transcriptSegments.length, 'transcript segments');
      const transcript = Array.from(transcriptSegments)
        .map((seg, index) => {
          // Try multiple ways to extract text
          let timeEl = seg.querySelector('.segment-timestamp');
          if (!timeEl) {
            timeEl = seg.querySelector('[class*="timestamp"]');
          }
          if (!timeEl && seg.children.length > 0) {
            timeEl = seg.children[0];
          }
          
          let textEl = seg.querySelector('.segment-text');
          if (!textEl) {
            textEl = seg.querySelector('[class*="text"]');
          }
          if (!textEl && seg.children.length > 1) {
            textEl = seg.children[1];
          }
          if (!textEl) {
            textEl = seg;
          }
          
          const time = timeEl?.textContent?.trim() || '';
          let text = textEl?.textContent?.trim() || seg.textContent?.trim() || '';
          
          // Remove time from text if it's duplicated
          if (time && text.includes(time)) {
            text = text.replace(time, '').trim();
          }
          
          // Clean up the text
          const cleanText = text.replace(/\s+/g, ' ').trim();
          
          if (cleanText && cleanText.length > 3) {
            if (time) {
              return `${time} ${cleanText}`;
            } else {
              return cleanText;
            }
          }
          return '';
        })
        .filter(text => text.length > 0)
        .join('\n');
      
      if (transcript && transcript.trim().length > 50) {
        console.log('Transcript extracted successfully, length:', transcript.length);
        console.log('First 200 chars:', transcript.substring(0, 200));
        return transcript;
      } else {
        console.log('Transcript too short or empty:', transcript?.length);
        console.log('Transcript content:', transcript);
      }
    } else {
      console.log('No transcript segments found');
    }
    
    // Fallback: try to get text from any visible transcript area
    const fallbackSelectors = [
      'ytd-transcript-renderer',
      'ytd-transcript-body-renderer',
      '#transcript'
    ];
    
    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.innerText || element.textContent;
        if (text && text.trim().length > 50) {
          console.log('Using fallback transcript extraction');
          return text.trim();
        }
      }
    }
    
    console.log('Could not extract transcript');
    return null;
  } catch (error) {
    console.error('Error getting transcript:', error);
    return null;
  }
}

// Listen for transcript request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTranscript') {
    getTranscript().then(transcript => {
      sendResponse({ transcript });
    });
    return true;
  }
});

