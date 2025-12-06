// Background service worker for API calls

// API Key - Get yours from https://makersuite.google.com/app/apikey
// Set it in the extension options or replace this value
let GEMINI_API_KEY = '';

// Try to get API key from storage, otherwise use default
chrome.storage.sync.get(['geminiApiKey'], (result) => {
  if (result.geminiApiKey) {
    GEMINI_API_KEY = result.geminiApiKey;
  }
});

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Format time in mm:ss format
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Parse transcript to estimate timestamps
function parseTranscriptWithTimestamps(transcript) {
  const lines = transcript.split('\n');
  const segments = [];
  
  lines.forEach(line => {
    const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1]);
      const seconds = parseInt(timeMatch[2]);
      const totalSeconds = minutes * 60 + seconds;
      const text = line.replace(/\d{1,2}:\d{2}/, '').trim();
      if (text) {
        segments.push({ time: totalSeconds, text });
      }
    }
  });
  
  return segments;
}

// Generate summary using Gemini API
async function generateSummary(videoData) {
  const { video_title, channel_name, video_url, duration_seconds, transcript } = videoData;

  if (!transcript || transcript.trim().length === 0) {
    return {
      error: "TRANSCRIPT_MISSING",
      meta: {
        title: video_title || "",
        channel: channel_name || "",
        url: video_url || "",
        duration_seconds: duration_seconds || 0
      },
      summary_short: "",
      summary_long: "",
      key_points: [],
      timestamps: [],
      faq: [],
      action_items: [],
      suggested_title: "",
      suggested_tags: [],
      suggested_description: ""
    };
  }

  const prompt = `You are an expert educational content summarizer. Your goal is to help learners understand complex video content in the shortest possible way while maintaining full context and clarity.

VIDEO INFORMATION:
- Title: ${video_title || 'Unknown'}
- Channel: ${channel_name || 'Unknown'}
- Duration: ${duration_seconds} seconds

TRANSCRIPT:
${transcript}

Your task is to create a comprehensive educational summary that:
1. Captures ALL important concepts and ideas from the video
2. Explains complex topics in simple, understandable language
3. Maintains the logical flow and context of the original content
4. Helps learners grasp the full video content without watching it
5. Organizes information in a way that's easy to learn and remember

Generate a comprehensive summary following this EXACT JSON structure (return ONLY valid JSON, no markdown, no code blocks):

{
  "error": null,
  "meta": {
    "title": "${video_title || ''}",
    "channel": "${channel_name || ''}",
    "url": "${video_url || ''}",
    "duration_seconds": ${duration_seconds || 0}
  },
  "summary_short": "A concise 2-3 sentence overview that captures the essence of the entire video",
  "summary_long": "A comprehensive, well-structured summary (3-5 paragraphs) that covers ALL major concepts, explanations, examples, and key takeaways. This should be detailed enough that someone can understand the full video content without watching it. Organize it logically with clear explanations of concepts, how they connect, and why they matter.",
  "key_points": [
    {"time": "mm:ss", "point": "Detailed explanation of each important concept or idea with context"}
  ],
  "timestamps": [
    {"time": "mm:ss", "label": "Clear section/chapter name describing what's covered"}
  ],
  "faq": [
    {"q": "Common question a learner might have", "a": "Clear, comprehensive answer that helps understanding"}
  ],
  "action_items": [
    "Practical step or concept to remember/apply"
  ],
  "suggested_title": "Optimized title suggestion",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "suggested_description": "SEO-optimized description"
}

CRITICAL REQUIREMENTS:
- summary_long MUST be comprehensive (3-5 paragraphs minimum) covering ALL major topics, concepts, explanations, and context
- Each key_point should be detailed enough to understand the concept fully
- Organize information logically - explain concepts, their relationships, and practical applications
- Use clear, educational language that helps learning
- Generate 8-15 key points covering all important concepts
- Generate 5-8 timestamps for major sections/chapters
- Generate 5-8 FAQ items addressing common learning questions
- Generate 3-6 action items with practical takeaways
- Use mm:ss format for all timestamps
- Return ONLY the JSON object, no additional text, no markdown formatting`;

  try {
    // Get API key from storage
    const storageResult = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKey = storageResult.geminiApiKey || GEMINI_API_KEY;
    
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Gemini API key not configured. Please set it in extension options or in background.js');
    }
    
    console.log('Sending request to Gemini API...');
    console.log('Transcript length:', transcript.length);
    console.log('Prompt length:', prompt.length);
    
    const apiUrl = `${GEMINI_API_URL}?key=${apiKey}`;
    console.log('API URL:', apiUrl.replace(apiKey, 'KEY_HIDDEN'));
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };
    
    console.log('Request body size:', JSON.stringify(requestBody).length);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += ` - ${errorJson.error?.message || errorText.substring(0, 100)}`;
      } catch (e) {
        errorMessage += ` - ${errorText.substring(0, 100)}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Gemini API response received');
    console.log('Response structure:', Object.keys(data));
    
    // Extract text from Gemini response
    let summaryText = '';
    if (data.candidates && data.candidates[0]) {
      console.log('Candidate found:', Object.keys(data.candidates[0]));
      if (data.candidates[0].content && data.candidates[0].content.parts) {
        summaryText = data.candidates[0].content.parts[0].text || '';
        console.log('Extracted from content.parts[0].text');
      } else if (data.candidates[0].text) {
        summaryText = data.candidates[0].text;
        console.log('Extracted from candidate.text');
      } else {
        console.log('No text found in candidate:', data.candidates[0]);
      }
    } else {
      console.error('No candidates in response:', data);
    }
    
    if (!summaryText || summaryText.trim().length === 0) {
      console.error('Empty response from Gemini API');
      console.error('Full response:', JSON.stringify(data, null, 2));
      // Don't throw, use fallback instead
      console.log('Using fallback summary due to empty API response');
      return createFallbackSummary(videoData, transcript);
    }
    
    console.log('Gemini API response received, length:', summaryText.length);
    console.log('First 500 chars:', summaryText.substring(0, 500));

    // Try to parse JSON from response
    let summary;
    try {
      // Remove markdown code blocks if present
      summaryText = summaryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON if there's extra text
      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryText = jsonMatch[0];
      }
      
      summary = JSON.parse(summaryText);
      console.log('Successfully parsed summary JSON');
      
      // Validate that summary has content
      if (!summary.summary_short || summary.summary_short.trim().length === 0) {
        console.warn('Summary has empty content, using fallback');
        summary = createFallbackSummary(videoData, transcript);
      } else {
        // Ensure all fields have content
        if (!summary.summary_long || summary.summary_long.trim().length === 0) {
          summary.summary_long = summary.summary_short;
        }
        if (!summary.key_points || summary.key_points.length === 0) {
          summary.key_points = [{ time: "00:00", point: "Key points from video content" }];
        }
        if (!summary.timestamps || summary.timestamps.length === 0) {
          summary.timestamps = [{ time: "00:00", label: "Introduction" }];
        }
      }
    } catch (parseError) {
      // If parsing fails, create a fallback summary
      console.error('Failed to parse JSON:', parseError);
      console.error('Response text:', summaryText.substring(0, 500));
      summary = createFallbackSummary(videoData, transcript);
    }

    // Process timestamps to ensure mm:ss format
    if (summary.key_points) {
      summary.key_points = summary.key_points.map(kp => {
        if (kp.time && !kp.time.match(/^\d{2}:\d{2}$/)) {
          // Try to convert to mm:ss
          const timeStr = kp.time.toString();
          if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length === 2) {
              kp.time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            }
          }
        }
        return kp;
      });
    }

    if (summary.timestamps) {
      summary.timestamps = summary.timestamps.map(ts => {
        if (ts.time && !ts.time.match(/^\d{2}:\d{2}$/)) {
          const timeStr = ts.time.toString();
          if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length === 2) {
              ts.time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            }
          }
        }
        return ts;
      });
    }

    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    // Try to create fallback summary from transcript if available
    if (transcript && transcript.trim().length > 0) {
      console.log('Creating fallback summary from transcript');
      return createFallbackSummary(videoData, transcript);
    }
    // If no transcript, return error structure
    return {
      error: `API_ERROR: ${error.message}`,
      meta: {
        title: video_title || "",
        channel: channel_name || "",
        url: video_url || "",
        duration_seconds: duration_seconds || 0
      },
      summary_short: `Error: ${error.message}. Please ensure the transcript is available.`,
      summary_long: `Unable to generate summary due to: ${error.message}. Please make sure the transcript panel is open on YouTube and try again.`,
      key_points: [],
      timestamps: [],
      faq: [],
      action_items: [],
      suggested_title: video_title || "",
      suggested_tags: [],
      suggested_description: ""
    };
  }
}

// Fallback summary if API fails
function createFallbackSummary(videoData, transcript) {
  const { video_title, channel_name, video_url, duration_seconds } = videoData;
  
  if (!transcript || transcript.trim().length === 0) {
    return {
      error: "TRANSCRIPT_MISSING",
      meta: {
        title: video_title || "",
        channel: channel_name || "",
        url: video_url || "",
        duration_seconds: duration_seconds || 0
      },
      summary_short: "",
      summary_long: "",
      key_points: [],
      timestamps: [],
      faq: [],
      action_items: [],
      suggested_title: video_title || "",
      suggested_tags: [],
      suggested_description: ""
    };
  }
  
  // Create a meaningful summary from transcript
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const firstFewSentences = sentences.slice(0, 3).join('. ').trim() + '.';
  const middleSentences = sentences.slice(Math.floor(sentences.length / 2), Math.floor(sentences.length / 2) + 3).join('. ').trim() + '.';
  const lastFewSentences = sentences.slice(-2).join('. ').trim() + '.';
  
  const shortSummary = firstFewSentences.length > 50 ? firstFewSentences.substring(0, 200) + '...' : firstFewSentences;
  const longSummary = `${firstFewSentences}\n\n${middleSentences}\n\n${lastFewSentences}`;
  
  // Extract key points from transcript
  const keyPoints = [];
  const transcriptLines = transcript.split('\n').filter(line => line.trim().length > 20);
  for (let i = 0; i < Math.min(8, transcriptLines.length); i++) {
    const line = transcriptLines[i];
    const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
    const time = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '00:00';
    const text = line.replace(/\d{1,2}:\d{2}/, '').trim().substring(0, 100);
    if (text) {
      keyPoints.push({ time, point: text });
    }
  }
  
  return {
    error: null,
    meta: {
      title: video_title || "",
      channel: channel_name || "",
      url: video_url || "",
      duration_seconds: duration_seconds || 0
    },
    summary_short: shortSummary || "Summary generated from transcript.",
    summary_long: longSummary || transcript.substring(0, 500) + '...',
    key_points: keyPoints.length > 0 ? keyPoints : [{ time: "00:00", point: "Video content extracted from transcript" }],
    timestamps: keyPoints.slice(0, 5).map((kp, i) => ({ time: kp.time, label: `Section ${i + 1}` })),
    faq: [],
    action_items: [],
    suggested_title: video_title || "",
    suggested_tags: [],
    suggested_description: ""
  };
}

// Fetch video data from YouTube (basic metadata)
async function fetchVideoData(videoId) {
  try {
    // Use YouTube oEmbed API for basic info
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch video data');
    }
    
    const data = await response.json();
    
    return {
      video_title: data.title || null,
      channel_name: data.author_name || null,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      duration_seconds: 0, // oEmbed doesn't provide duration
      transcript: null
    };
  } catch (error) {
    console.error('Error fetching video data:', error);
    return {
      video_title: null,
      channel_name: null,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      duration_seconds: 0,
      transcript: null
    };
  }
}

// Fetch transcript from YouTube (this is a placeholder - actual implementation would need YouTube API)
async function fetchTranscript(videoId) {
  // Note: YouTube doesn't provide public API for transcripts without authentication
  // This would require using YouTube Data API v3 with proper authentication
  // For now, return null - the content script method should be used instead
  return null;
}

// Listen for all message types
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateSummary') {
    generateSummary(request.videoData)
      .then(summary => sendResponse({ success: true, summary }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'fetchVideoData') {
    fetchVideoData(request.videoId)
      .then(videoData => sendResponse({ videoData }))
      .catch(error => sendResponse({ videoData: null, error: error.message }));
    return true;
  }
  
  if (request.action === 'fetchTranscript') {
    fetchTranscript(request.videoId)
      .then(transcript => sendResponse({ transcript }))
      .catch(error => sendResponse({ transcript: null, error: error.message }));
    return true;
  }
  
  return false;
});

