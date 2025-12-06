// Popup script for UI interactions

let currentSummary = null;
let currentVideoData = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkCurrentTab();
  setupEventListeners();
});

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url && tab.url.includes('youtube.com/watch')) {
      // Try to extract video data from current tab
      try {
        await ensureContentScript(tab.id);
        const videoData = await chrome.tabs.sendMessage(tab.id, { action: 'extractVideoData' });
        
        if (videoData) {
          currentVideoData = videoData;
          displayVideoInfo(videoData);
          // Pre-fill URL input
          document.getElementById('youtubeUrl').value = tab.url;
        }
      } catch (error) {
        console.log('Could not extract from current tab:', error);
        // Don't show error, just allow URL input
      }
    }
  } catch (error) {
    console.error('Error checking tab:', error);
    // Don't show error on init
  }
}

// Ensure content script is injected
async function ensureContentScript(tabId) {
  try {
    // Try to send a message first
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    // If it fails, inject the script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError);
      throw injectError;
    }
  }
}

function displayVideoInfo(videoData) {
  document.getElementById('videoTitle').textContent = videoData.video_title || 'Unknown';
  document.getElementById('channelName').textContent = videoData.channel_name || 'Unknown';
  document.getElementById('duration').textContent = formatDuration(videoData.duration_seconds || 0);
  document.getElementById('videoInfo').style.display = 'block';
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function setupEventListeners() {
  document.getElementById('summarizeBtn').addEventListener('click', handleSummarize);
  document.getElementById('copyJsonBtn').addEventListener('click', copyJson);
  document.getElementById('loadUrlBtn').addEventListener('click', handleLoadUrl);
  document.getElementById('youtubeUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLoadUrl();
    }
  });
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

async function handleLoadUrl() {
  const urlInput = document.getElementById('youtubeUrl');
  const url = urlInput.value.trim();
  
  if (!url) {
    showStatus('Please enter a YouTube URL', 'error');
    return;
  }

  // Validate YouTube URL
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(youtubeRegex);
  
  if (!match) {
    showStatus('Invalid YouTube URL', 'error');
    return;
  }

  const videoId = match[1];
  const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  showStatus('Loading video...', 'info');
  
  try {
    // Try to find existing tab with this URL
    const tabs = await chrome.tabs.query({ url: fullUrl });
    let targetTab = tabs[0];
    
    if (!targetTab) {
      // Create new tab
      targetTab = await chrome.tabs.create({ url: fullUrl, active: false });
      // Wait for page to load
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === targetTab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Timeout after 10 seconds
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 10000);
      });
    }
    
    // Ensure content script is injected
    await ensureContentScript(targetTab.id);
    
    // Extract video data
    const videoData = await chrome.tabs.sendMessage(targetTab.id, { action: 'extractVideoData' });
    
    if (videoData) {
      currentVideoData = videoData;
      displayVideoInfo(videoData);
      showStatus('Video loaded successfully!', 'success');
    } else {
      throw new Error('Could not extract video data');
    }
  } catch (error) {
    console.error('Error loading URL:', error);
    showStatus('Error loading video: ' + error.message, 'error');
  }
}

async function handleSummarize() {
  const btn = document.getElementById('summarizeBtn');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  showStatus('Extracting video data and transcript...', 'info');

  try {
    let videoData = currentVideoData;
    
    // If we have a URL but no video data, try to get it
    if (!videoData) {
      const urlInput = document.getElementById('youtubeUrl').value.trim();
      if (urlInput) {
        // Extract video ID and fetch data
        const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = urlInput.match(youtubeRegex);
        if (match) {
          const videoId = match[1];
          videoData = await fetchVideoDataFromUrl(videoId);
          currentVideoData = videoData;
        }
      }
    }
    
    // If still no video data, try current tab
    if (!videoData) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url && tab.url.includes('youtube.com/watch')) {
        await ensureContentScript(tab.id);
        videoData = await chrome.tabs.sendMessage(tab.id, { action: 'extractVideoData' });
        currentVideoData = videoData;
      }
    }
    
    if (!videoData) {
      throw new Error('No video data available. Please load a video first.');
    }
    
    // Try to get transcript from current tab if it's a YouTube page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url && tab.url.includes('youtube.com/watch')) {
        await ensureContentScript(tab.id);
        showStatus('Fetching transcript...', 'info');
        
        // Wait a bit for page to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const transcriptResult = await chrome.tabs.sendMessage(tab.id, { action: 'getTranscript' });
        
        console.log('Transcript result:', transcriptResult);
        
        if (transcriptResult && transcriptResult.transcript && transcriptResult.transcript.trim().length > 0) {
          videoData.transcript = transcriptResult.transcript;
          console.log('Transcript extracted, length:', transcriptResult.transcript.length);
          showStatus(`Transcript found (${Math.round(transcriptResult.transcript.length / 1000)}k chars)`, 'success');
        } else {
          showStatus('Transcript not found. Please open the transcript panel manually on YouTube (click "Show transcript" button below the video).', 'warning');
        }
      }
    } catch (error) {
      console.error('Could not get transcript from tab:', error);
      showStatus('Could not extract transcript automatically. Please open the transcript panel manually.', 'warning');
    }
    
    // If no transcript, try to fetch from background
    if (!videoData.transcript) {
      showStatus('Fetching transcript via API...', 'info');
      try {
        const transcriptResponse = await chrome.runtime.sendMessage({
          action: 'fetchTranscript',
          videoId: extractVideoId(videoData.video_url)
        });
        if (transcriptResponse && transcriptResponse.transcript) {
          videoData.transcript = transcriptResponse.transcript;
        }
      } catch (error) {
        console.log('Could not fetch transcript:', error);
      }
    }
    
    if (!videoData.transcript || videoData.transcript.trim().length === 0) {
      showStatus('ERROR: No transcript found. Please open the transcript panel first.', 'error');
      document.getElementById('transcriptHelp').style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Generate Summary';
      return;
    }
    
    // Hide help if transcript is found
    document.getElementById('transcriptHelp').style.display = 'none';
    
    console.log('Video data with transcript:', {
      title: videoData.video_title,
      transcriptLength: videoData.transcript.length
    });

    // Generate summary
    showStatus('Generating summary with AI...', 'info');
    const response = await chrome.runtime.sendMessage({
      action: 'generateSummary',
      videoData: videoData
    });

    console.log('Summary response:', response);

    if (!response) {
      throw new Error('No response from background script');
    }

    if (response.success && response.summary) {
      currentSummary = response.summary;
      console.log('Summary data:', response.summary);
      displaySummary(response.summary);
      showStatus('Summary generated successfully!', 'success');
      document.getElementById('copyJsonBtn').style.display = 'block';
    } else if (response.summary) {
      // Even if success is false, try to display if we have summary
      currentSummary = response.summary;
      console.log('Displaying summary despite success=false:', response.summary);
      displaySummary(response.summary);
      showStatus('Summary generated (with warnings)', 'warning');
      document.getElementById('copyJsonBtn').style.display = 'block';
    } else {
      throw new Error(response?.error || 'Failed to generate summary');
    }
  } catch (error) {
    console.error('Error:', error);
    showStatus('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Summary';
  }
}

function extractVideoId(url) {
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

async function fetchVideoDataFromUrl(videoId) {
  // Use background script to fetch video data
  const response = await chrome.runtime.sendMessage({
    action: 'fetchVideoData',
    videoId: videoId
  });
  
  if (response && response.videoData) {
    return response.videoData;
  }
  
  // Fallback: return basic structure
  return {
    video_title: null,
    channel_name: null,
    video_url: `https://www.youtube.com/watch?v=${videoId}`,
    duration_seconds: 0,
    transcript: null
  };
}

function displaySummary(summary) {
  console.log('Displaying summary:', summary);
  
  if (!summary) {
    showStatus('Error: No summary data received', 'error');
    return;
  }

  // Show summary container first
  const summaryContainerEl = document.getElementById('summaryContainer');
  if (summaryContainerEl) {
    summaryContainerEl.style.display = 'block';
  }

  // Handle error case but still try to show what we have
  if (summary.error && summary.error !== null) {
    showStatus(`Warning: ${summary.error}`, 'warning');
    // Don't return - still try to display what we have
  }

  // Display summaries
  const shortSummaryEl = document.getElementById('shortSummary');
  const longSummaryEl = document.getElementById('longSummary');
  
  if (shortSummaryEl) {
    const shortText = summary.summary_short?.trim() || summary.summary_long?.trim() || 'Generating summary...';
    shortSummaryEl.textContent = shortText;
    console.log('Short summary set:', shortText.substring(0, 50));
  }
  
  if (longSummaryEl) {
    const longText = summary.summary_long?.trim() || summary.summary_short?.trim() || 'Summary is being generated. Please wait...';
    longSummaryEl.textContent = longText;
    longSummaryEl.style.display = 'block';
    console.log('Long summary set, length:', longText.length);
  }

  // Display key points
  const keyPointsList = document.getElementById('keyPointsList');
  keyPointsList.innerHTML = '';
  if (summary.key_points && summary.key_points.length > 0) {
    summary.key_points.forEach((kp, index) => {
      const li = document.createElement('li');
      li.className = 'key-point-item';
      li.innerHTML = `
        <div class="key-point-header">
          <span class="key-point-number">${index + 1}</span>
          <strong class="key-point-time">${kp.time || '00:00'}</strong>
        </div>
        <div class="key-point-content">${kp.point || ''}</div>
      `;
      keyPointsList.appendChild(li);
    });
  } else {
    keyPointsList.innerHTML = '<li>No key points available</li>';
  }

  // Display timestamps
  const timestampsList = document.getElementById('timestampsList');
  timestampsList.innerHTML = '';
  if (summary.timestamps && summary.timestamps.length > 0) {
    summary.timestamps.forEach(ts => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${ts.time || '00:00'}</strong>: ${ts.label || ''}`;
      timestampsList.appendChild(li);
    });
  } else {
    timestampsList.innerHTML = '<li>No timestamps available</li>';
  }

  // Display FAQ
  const faqList = document.getElementById('faqList');
  faqList.innerHTML = '';
  if (summary.faq && summary.faq.length > 0) {
    summary.faq.forEach(faq => {
      const div = document.createElement('div');
      div.className = 'faq-item';
      div.innerHTML = `
        <strong>Q: ${faq.q || ''}</strong>
        <p>A: ${faq.a || ''}</p>
      `;
      faqList.appendChild(div);
    });
  } else {
    faqList.innerHTML = '<p>No FAQ items available</p>';
  }

  // Display JSON
  document.getElementById('jsonOutput').textContent = JSON.stringify(summary, null, 2);

  // Display suggestions
  const suggestedTitle = summary.suggested_title?.trim() || summary.meta?.title || '';
  const suggestedTags = summary.suggested_tags?.join(', ') || '';
  const suggestedDescription = summary.suggested_description?.trim() || '';
  
  if (suggestedTitle || suggestedTags || suggestedDescription) {
    const titleEl = document.getElementById('suggestedTitle');
    const tagsEl = document.getElementById('suggestedTags');
    const descEl = document.getElementById('suggestedDescription');
    
    if (titleEl) titleEl.textContent = suggestedTitle || 'Not available';
    if (tagsEl) tagsEl.textContent = suggestedTags || 'Not available';
    if (descEl) descEl.textContent = suggestedDescription || 'Not available';
    
    document.getElementById('suggestions').style.display = 'block';
  }

  // Ensure summary container is visible (variable already declared above)
  if (summaryContainerEl) {
    summaryContainerEl.style.display = 'block';
    // Scroll to top of container
    summaryContainerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  console.log('Summary display completed');
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
}

function copyJson() {
  if (!currentSummary) return;
  
  const jsonString = JSON.stringify(currentSummary, null, 2);
  navigator.clipboard.writeText(jsonString).then(() => {
    showStatus('JSON copied to clipboard!', 'success');
    setTimeout(() => {
      const status = document.getElementById('status');
      if (status.textContent.includes('copied')) {
        status.textContent = '';
        status.className = 'status';
      }
    }, 2000);
  }).catch(err => {
    showStatus('Failed to copy: ' + err.message, 'error');
  });
}

function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      if (statusEl.textContent === message) {
        statusEl.textContent = '';
        statusEl.className = 'status';
      }
    }, 3000);
  }
}

