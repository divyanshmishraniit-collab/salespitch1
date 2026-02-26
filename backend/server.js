// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();


// Import pdf-parse - handle both CommonJS and ES module exports
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  // If it's an object with default, use the default
  if (pdfParse && typeof pdfParse === 'object' && pdfParse.default) {
    pdfParse = pdfParse.default;
  }
} catch (e) {
  console.error('Failed to load pdf-parse:', e);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory storage for book content
let booksContent = [];
let conversationHistory = [];
let sessionState = {
  effectivenessScore: 0,
  negotiationPhase: false,
  currentProposedValue: null,
  dealClosed: false,
  negotiationHistory: [],
  lastLLMProposedValue: null,
  priceHistory: []
};

// LiteLLM API configuration
const LITELLM_API_URL = 'https://litellm.niit.com/v1/chat/completions';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-LOAD: Scan uploads/ on startup and populate booksContent
// ─────────────────────────────────────────────────────────────────────────────
async function loadBooksFromUploadsDir() {
  const uploadsDir = path.join(__dirname, 'uploads');

  // Ensure uploads directory exists
  await fs.mkdir(uploadsDir, { recursive: true });

  let files;
  try {
    files = await fs.readdir(uploadsDir);
  } catch (err) {
    console.error('❌ Could not read uploads directory:', err.message);
    return;
  }

  const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));

  if (pdfs.length === 0) {
    console.log('📂 No PDFs found in uploads/ — waiting for upload.');
    return;
  }

  console.log(`\n📚 Auto-loading ${pdfs.length} PDF(s) from uploads/…`);

  for (const filename of pdfs) {
    const filePath = path.join(uploadsDir, filename);
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer, { max: 0, version: 'v1.10.100' });

      const chunks = chunkText(pdfData.text, 100000);

      booksContent.push({
        filename,
        content: pdfData.text.slice(0, 500000),
        chunks,
        pages: pdfData.numpages,
        size: pdfData.text.length
      });

      console.log(`   ✅ Loaded: ${filename} (${pdfData.numpages} pages, ${(pdfData.text.length / 1024).toFixed(2)} KB)`);
    } catch (err) {
      console.error(`   ❌ Failed to load ${filename}:`, err.message);
    }
  }

  console.log(`📚 ${booksContent.length} book(s) ready.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────

// Function to call LiteLLM API
async function callLiteLLM(messages, maxTokens = 1000) {
  try {
    console.log(`📤 Calling LiteLLM with ${messages.length} messages, max ${maxTokens} tokens`);
    
    const response = await axios.post(
      LITELLM_API_URL,
      {
        model: 'azure-gpt-4o',
        messages: messages,
        max_tokens: maxTokens,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${LITELLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    console.log('✅ LiteLLM response received');
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('LiteLLM API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new Error('API Key invalid or expired');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - please try again');
    } else {
      throw new Error(`Failed to get response from AI: ${error.message}`);
    }
  }
}

// Function to chunk text into smaller parts
function chunkText(text, maxChunkSize = 50000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChunkSize) {
    chunks.push(text.slice(i, i + maxChunkSize));
  }
  return chunks;
}

// Function to create RAG context from books
function createRAGContext(query, maxLength = 3000) {
  const keywords = query.toLowerCase().split(' ').filter(k => k.length > 3);
  const relevantSections = [];

  booksContent.forEach(book => {
    const chunks = book.chunks || [book.content];
    
    chunks.forEach(chunk => {
      const sentences = chunk.split(/[.!?]+/);
      sentences.forEach(sentence => {
        if (sentence.trim().length < 20) return;
        
        const sentenceLower = sentence.toLowerCase();
        const matchCount = keywords.filter(kw => sentenceLower.includes(kw)).length;
        
        if (matchCount > 1) {
          relevantSections.push({
            text: sentence.trim(),
            score: matchCount
          });
        }
      });
    });
  });

  relevantSections.sort((a, b) => b.score - a.score);
  
  let context = '';
  for (const section of relevantSections) {
    if (context.length + section.text.length > maxLength) break;
    context += section.text + '. ';
  }
  
  return context || 'General sales best practices apply.';
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Endpoint to delete a PDF by filename
app.delete('/api/delete-book/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }
    const filePath = path.join(__dirname, 'uploads', filename);
    await fs.unlink(filePath);

    // Also remove from in-memory booksContent
    booksContent = booksContent.filter(b => b.filename !== filename);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete file', error: err.message });
  }
});

// Endpoint to list uploaded PDFs
app.get('/api/list-books', async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    const files = await fs.readdir(uploadsDir);
    const pdfs = files.filter(f => f.endsWith('.pdf'));
    res.json({ success: true, books: pdfs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list books', error: err.message });
  }
});

// Storage for uploaded PDFs with higher limits
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Password verification endpoint
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD;

  if (!correctPassword) {
    return res.status(500).json({ success: false, message: 'Server password not configured' });
  }

  if (password === correctPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password' });
  }
});

// Upload and process books
app.post('/api/upload-books', upload.array('pdfs', 3), async (req, res) => {
  try {
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const processedBooks = [];

    for (const file of files) {
      try {
        console.log(`📖 Processing: ${file.originalname}...`);

        const uploadsDir = path.join(__dirname, 'uploads');
        const newFilePath = path.join(uploadsDir, file.originalname);
        await fs.rename(file.path, newFilePath);

        const dataBuffer = await fs.readFile(newFilePath);

        const pdfData = await pdfParse(dataBuffer, {
          max: 0,
          version: 'v1.10.100'
        });

        console.log(`✅ Parsed: ${file.originalname} (${pdfData.numpages} pages, ${(pdfData.text.length / 1024).toFixed(2)} KB)`);

        const chunks = chunkText(pdfData.text, 100000);

        // Replace existing entry if already loaded (e.g. from auto-load), or push new
        const existingIndex = booksContent.findIndex(b => b.filename === file.originalname);
        const bookEntry = {
          filename: file.originalname,
          content: pdfData.text.slice(0, 500000),
          chunks,
          pages: pdfData.numpages,
          size: pdfData.text.length
        };

        if (existingIndex >= 0) {
          booksContent[existingIndex] = bookEntry;
        } else {
          booksContent.push(bookEntry);
        }

        processedBooks.push({
          name: file.originalname,
          pages: pdfData.numpages,
          size: (pdfData.text.length / 1024).toFixed(2) + ' KB'
        });

      } catch (pdfError) {
        console.error(`❌ Error processing ${file.originalname}:`, pdfError.message);
        try { await fs.unlink(file.path); } catch (_) {}
        continue;
      }
    }

    if (processedBooks.length === 0) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to process any PDF files. Please ensure they are valid PDFs and not password-protected.' 
      });
    }

    console.log(`\n📚 Successfully processed ${processedBooks.length} books:`);
    processedBooks.forEach(book => {
      console.log(`   - ${book.name}: ${book.pages} pages, ${book.size}`);
    });
    
    res.json({ 
      success: true, 
      message: 'Books uploaded and processed successfully', 
      count: booksContent.length,
      books: processedBooks
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing books', 
      error: error.message 
    });
  }
});

// Start a new practice session
app.post('/api/start-session', async (req, res) => {
  try {
    if (booksContent.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please upload training books first' 
      });
    }

    conversationHistory = [];
    sessionState = {
      effectivenessScore: 0,
      negotiationPhase: false,
      currentProposedValue: null,
      dealClosed: false,
      negotiationHistory: [],
      lastLLMProposedValue: null,
      priceHistory: []
    };

    const systemPrompt = `You are an expert sales coach trained on comprehensive sales and skills training materials. 
Your role is to:
1. Evaluate sales pitches for a GenAI Training program (which provides AI tool training to company cohorts)
2. Ask challenging questions that real prospects would ask
3. Provide constructive feedback based on sales best practices from the training materials
4. Guide the salesperson to improve their pitch

The GenAI Training product helps companies train their employees to use AI tools more efficiently through cohort-based training programs.

Be encouraging but critical. Ask tough questions like "Why should I buy from you instead of competitors?" or "How do you measure ROI?" 

Keep responses concise and actionable.`;

    const initialPrompt = `Welcome! I'm your AI sales coach trained on sales best practices from ${booksContent.length} comprehensive training books.

I'll help you perfect your pitch for the GenAI Training program. Please start by presenting your initial pitch. I'll listen carefully and provide feedback based on proven sales techniques.

Ready when you are!`;

    conversationHistory.push({
      role: 'system',
      content: systemPrompt
    });

    res.json({ success: true, initialPrompt });
  } catch (error) {
    console.error('Session start error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error starting session', 
      error: error.message 
    });
  }
});

// Analyze initial pitch
app.post('/api/analyze-pitch', async (req, res) => {
  try {
    const { pitch } = req.body;

    if (!pitch) {
      return res.status(400).json({ success: false, message: 'No pitch provided' });
    }

    if (booksContent.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please upload training books first' 
      });
    }

    console.log(`\n🎯 Analyzing pitch (${pitch.length} chars)...`);

    const context = createRAGContext(pitch + ' sales pitch presentation opening value proposition hook', 2500);
    console.log(`📖 RAG Context retrieved (${context.length} chars)`);

    conversationHistory.push({
      role: 'user',
      content: pitch
    });

    const analysisPrompt = `Based on these sales training principles:

${context}

Analyze this sales pitch for a GenAI Training program:
"${pitch}"

Provide a structured analysis with:

**What They Did Well:**
- List 2-3 strong points

**What Needs Improvement:**
- List 2-3 areas to work on

**Specific Suggestions:**
- Give actionable recommendations based on sales best practices

**Challenging Question:**
Ask one tough question a prospect might ask (like "Why should I choose you over competitors?" or "How do you measure ROI for your training?" or "What's your implementation process?")

IMPORTANT: Do NOT ask about pricing or budget at this stage. Focus on the pitch quality, value proposition, and customer pain points.

Keep it concise, constructive, and encouraging.`;

    conversationHistory.push({
      role: 'user',
      content: analysisPrompt
    });

    console.log('🤖 Calling AI for analysis...');
    const analysis = await callLiteLLM(conversationHistory, 1200);

    conversationHistory.push({
      role: 'assistant',
      content: analysis
    });

    console.log('✅ Analysis complete');
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('❌ Pitch analysis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error analyzing pitch', 
      error: error.message 
    });
  }
});

// Analyze response to AI questions
app.post('/api/analyze-response', async (req, res) => {
  try {
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({ success: false, message: 'No response provided' });
    }

    if (booksContent.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please upload training books first' 
      });
    }

    console.log(`\n💬 Analyzing response (${response.length} chars)...`);

    const context = createRAGContext(response + ' objection handling sales response customer questions', 2500);
    console.log(`📖 RAG Context retrieved (${context.length} chars)`);

    conversationHistory.push({
      role: 'user',
      content: response
    });

    const feedbackPrompt = `Based on these sales training principles:

${context}

The salesperson responded with:
"${response}"

Provide feedback in this format:

**Effectiveness Score:** X/10

**What Was Effective:**
- List what worked well in their response

**What Could Be Improved:**
- List areas for improvement

**Next Step:**
Either ask ONE more challenging prospect question about the product, implementation, timeline, or company fit (like "How does your training adapt to different learning styles?" or "What's the typical time to see ROI?") OR if they've handled 3+ questions well, congratulate them and provide a brief summary.

IMPORTANT: Do NOT ask about pricing, budget, or costs at this stage. Only discuss pricing during the negotiation phase.

Keep it conversational and encouraging.`;

    conversationHistory.push({
      role: 'user',
      content: feedbackPrompt
    });

    console.log('🤖 Calling AI for feedback...');
    const feedback = await callLiteLLM(conversationHistory, 1000);

    conversationHistory.push({
      role: 'assistant',
      content: feedback
    });

    const scoreMatch = feedback.match(/\*\*Effectiveness Score:\*\*\s*(\d+)/i);
    const currentScore = scoreMatch ? parseInt(scoreMatch[1]) : sessionState.effectivenessScore;
    sessionState.effectivenessScore = Math.max(sessionState.effectivenessScore, currentScore);

    console.log(`✅ Feedback complete. Current score: ${sessionState.effectivenessScore}/10`);
    
    let shouldAskNegotiation = sessionState.effectivenessScore >= 6 && !sessionState.negotiationPhase && !sessionState.dealClosed;
    
    res.json({ 
      success: true, 
      feedback,
      effectivenessScore: sessionState.effectivenessScore,
      shouldAskNegotiation
    });
  } catch (error) {
    console.error('❌ Response analysis error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error analyzing response', 
      error: error.message 
    });
  }
});

// Enter negotiation phase
app.post('/api/start-negotiation', async (req, res) => {
  try {
    const { userResponse } = req.body;

    if (!userResponse) {
      return res.status(400).json({ success: false, message: 'No response provided' });
    }

    const readyForNegotiation = userResponse.toLowerCase().includes('yes') || 
                                 userResponse.toLowerCase().includes('ready') ||
                                 userResponse.toLowerCase().includes('proceed');

    if (!readyForNegotiation) {
      conversationHistory.push({
        role: 'user',
        content: userResponse
      });

      const response = `I understand. Take your time! Remember, the stronger your pitch, the better position you're in for negotiation. Would you like to practice more, or are you ready to move forward?`;

      conversationHistory.push({
        role: 'assistant',
        content: response
      });

      return res.json({ 
        success: true, 
        message: response,
        negotiationStarted: false
      });
    }

    sessionState.negotiationPhase = true;
    
    conversationHistory.push({
      role: 'user',
      content: userResponse
    });

    const negotiationStart = `Great! Let's move into the negotiation phase. I'm impressed with your presentation.

Now, let's talk about pricing. **How much are you asking for the GenAI Training program?** Please tell me your proposed value/price.

(Note: We are now in negotiation mode. All further discussion will focus on pricing and deal terms.)`;

    conversationHistory.push({
      role: 'assistant',
      content: negotiationStart
    });

    res.json({ 
      success: true, 
      message: negotiationStart,
      negotiationStarted: true,
      proposedValue: null
    });
  } catch (error) {
    console.error('❌ Negotiation start error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error starting negotiation', 
      error: error.message 
    });
  }
});

// Handle price proposal from salesperson
app.post('/api/propose-price', async (req, res) => {
  try {
    const { priceProposal } = req.body;

    if (!priceProposal) {
      return res.status(400).json({ success: false, message: 'No price proposal provided' });
    }

    console.log(`\n💰 Price proposal received: ${priceProposal}`);

    conversationHistory.push({
      role: 'user',
      content: `I'm asking for: ${priceProposal}`
    });

    sessionState.currentProposedValue = priceProposal;
    sessionState.negotiationHistory.push({
      proposedBy: 'salesperson',
      value: priceProposal,
      timestamp: new Date().toISOString()
    });

    const context = createRAGContext('negotiation pricing objection handling competitive advantages value proposition ROI', 2000);

    const negotiationPrompt = `You are acting as a professional, pragmatic buyer in a negotiation scenario for a GenAI Training program.

The salesperson just proposed: "${priceProposal}"

Your role is to be FAIR but FIRM:
1. Be thoughtful and ask legitimate questions about their pricing
2. Understand your market position - mention reasonable market comparisons
3. Make a counter-offer (20-30% lower than proposed) that's realistic and fair
4. Focus on understanding the VALUE they're providing
5. Ask practical questions like:
   - "Can you break down what's included in that price?"
   - "What results can we typically expect from your training?"
   - "How does your pricing compare to industry standards?"
6. Listen to their justifications and engage genuinely
7. Be collaborative but advocate for your organization's budget
8. Show interest in finding a mutually beneficial agreement

IMPORTANT: Be professional and solution-focused. This is a verbal negotiation between two reasonable people looking to make a deal work.

Use sales training principles:
${context}

Respond as the buyer/prospect would. Make your counter-offer very specific with an exact number. Be open to discussion and finding common ground.`;

    conversationHistory.push({
      role: 'user',
      content: negotiationPrompt
    });

    console.log('🤖 Calling AI for counter-offer...');
    const counterOffer = await callLiteLLM(conversationHistory, 1000);

    conversationHistory.push({
      role: 'assistant',
      content: counterOffer
    });

    const valueMatch = counterOffer.match(/\$?[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:per|\/)?/i);
    const extractedValue = valueMatch ? valueMatch[0] : 'to be determined';

    sessionState.lastLLMProposedValue = extractedValue;

    sessionState.negotiationHistory.push({
      proposedBy: 'llm',
      value: extractedValue,
      timestamp: new Date().toISOString()
    });

    sessionState.priceHistory.push({
      proposedBy: 'llm',
      value: extractedValue,
      round: Math.ceil(sessionState.negotiationHistory.length / 2)
    });

    console.log(`✅ Counter-offer generated: ${extractedValue}`);
    
    res.json({ 
      success: true, 
      counterOffer,
      llmCounterValue: extractedValue
    });
  } catch (error) {
    console.error('❌ Price proposal error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing price proposal', 
      error: error.message 
    });
  }
});

// Handle salesperson's response to counter-offer
app.post('/api/negotiate-response', async (req, res) => {
  try {
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({ success: false, message: 'No response provided' });
    }

    console.log(`\n💬 Negotiation response received: ${response.slice(0, 100)}...`);

    const priceMatch = response.match(/\$?[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:per|\/)?/i);
    const salespersonProposedPrice = priceMatch ? priceMatch[0] : null;
    
    const parsePrice = (priceStr) => {
      if (!priceStr) return null;
      const numStr = priceStr.replace(/[^\d.]/g, '');
      return parseFloat(numStr);
    };

    const salespersonPriceNum = salespersonProposedPrice ? parsePrice(salespersonProposedPrice) : null;
    const llmProposedNum = sessionState.lastLLMProposedValue ? parsePrice(sessionState.lastLLMProposedValue) : null;

    const acceptanceKeywords = [
      'let\'s do it', 
      'you\'ve got a deal', 
      'deal accepted', 
      'agreed at that price', 
      'i accept your final offer', 
      'ok lets do', 
      'agreed', 
      'let\'s do the deal',
      'close the deal',
      'lets close',
      'sharing the documents',
      'share the documents',
      'send the documents',
      'we will be sharing',
      'we\'ll be sharing',
      'let\'s finalize',
      'let\'s move forward',
      'sounds good'
    ];
    const hasAcceptanceKeyword = acceptanceKeywords.some(keyword => response.toLowerCase().includes(keyword));

    let isDealClosed = false;
    let shouldAutoClose = false;
    let closingReason = '';

    if (hasAcceptanceKeyword) {
      isDealClosed = true;
      shouldAutoClose = true;
      if (salespersonPriceNum && llmProposedNum && salespersonPriceNum < llmProposedNum) {
        closingReason = 'lower_than_llm_proposal';
      } else if (salespersonPriceNum && salespersonPriceNum < 60000) {
        closingReason = 'below_60k';
      } else {
        closingReason = 'normal_acceptance';
      }
    }

    conversationHistory.push({
      role: 'user',
      content: response
    });

    if (shouldAutoClose) {
      sessionState.dealClosed = true;

      let closingMessage = '';
      
      if (closingReason === 'below_60k') {
        closingMessage = `Perfect! That's a great price point, and I'm happy to move forward at that rate. Let's close this deal! 🎉

**Deal Summary:**
- Program: GenAI Training for your organization
- Final Negotiated Value: ${salespersonProposedPrice}
- Status: CLOSED ✅

You demonstrated excellent negotiation skills by holding your ground and offering a competitive price that works for both parties.`;
      } 
      else if (closingReason === 'lower_than_llm_proposal') {
        closingMessage = `Excellent! That's even better than what I was hoping for. You've shown strong negotiation skills, and I'm genuinely impressed. Let's close this! 🎉

**Deal Summary:**
- Program: GenAI Training for your organization
- Final Negotiated Value: ${salespersonProposedPrice}
- Status: CLOSED ✅

You went above and beyond in your negotiation - understanding the buyer's position and offering something even more favorable. That's exceptional sales acumen!`;
      } 
      else {
        closingMessage = `Great! We have a deal! 🎉

**Deal Summary:**
- Program: GenAI Training for your organization
- Final Negotiated Value: ${salespersonProposedPrice}
- Status: CLOSED ✅

You successfully found a fair agreement that works for both of us. You handled the negotiation professionally and reached a mutually beneficial outcome.`;
      }

      closingMessage += `

**Your Performance Analysis:**
You demonstrated excellent negotiation skills by:
- Presenting a clear value proposition
- Responding to buyer concerns professionally
- Finding common ground through effective communication
- Closing the deal by understanding when to move forward

This is a critical skill in enterprise sales. You successfully navigated a realistic buyer who had legitimate concerns and budget constraints, and you managed to reach an agreement that satisfies both parties.

**Key Lesson:** Great sales aren't just about price - they're about building trust and making the buyer feel heard. You did that here.

Well done! 🏆`;

      conversationHistory.push({
        role: 'assistant',
        content: closingMessage
      });

      sessionState.negotiationHistory.push({
        proposedBy: 'salesperson',
        value: salespersonProposedPrice,
        status: 'DEAL_CLOSED',
        timestamp: new Date().toISOString()
      });

      return res.json({ 
        success: true, 
        message: closingMessage,
        dealClosed: true,
        finalValue: salespersonProposedPrice
      });
    }

    const valueMatch = response.match(/\$?[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:per|\/)?/i);
    const newProposal = valueMatch ? valueMatch[0] : null;

    if (newProposal) {
      sessionState.currentProposedValue = newProposal;
      sessionState.negotiationHistory.push({
        proposedBy: 'salesperson',
        value: newProposal,
        timestamp: new Date().toISOString()
      });
      sessionState.priceHistory.push({
        proposedBy: 'salesperson',
        value: newProposal,
        round: Math.ceil(sessionState.negotiationHistory.length / 2)
      });
    }

    const context = createRAGContext('negotiation pricing objection handling competitive value ROI justification', 2000);

    const continuedNegotiationPrompt = `You are acting as a professional, pragmatic buyer in a sales negotiation for GenAI Training.

PRICE HISTORY FOR YOUR REFERENCE:
${sessionState.priceHistory.map((p, i) => `Round ${p.round}: ${p.proposedBy} proposed ${p.value}`).join('\n')}

The salesperson just responded with: "${response}"

Based on sales training principles:
${context}

Your role now (and for all subsequent responses):
1. STAY IN NEGOTIATION MODE - Focus on verbal discussion of pricing and deal terms only
2. Be FAIR but FIRM - you're a savvy buyer but open to reasonable offers
3. REMEMBER ALL PRICES - Reference what was previously proposed to maintain consistency
4. Consider their justifications thoughtfully - are they making good points?
5. If they haven't moved on price, ask clarifying questions to understand their constraints
6. Reference market rates realistically and what competitors typically offer
7. Ask practical qualifying questions:
   - "What's typically included in your program?"
   - "What kind of results do your training clients typically see?"
   - "What happens if the training isn't effective for our team?"
8. Evaluate if they're being reasonable and flexible
9. If you're close on price, show openness to moving forward
10. Only focus on VERBAL commitments and pricing - no documentation, contracts, or file submissions
11. If they're offering good value, be willing to accept and move forward

You need:
- Fair competitive pricing (ideally 20-30% below initial ask, or justified by exceptional value)
- Clear understanding of what's included verbally
- Confidence that this will deliver value for our organization
- A reasonable path forward

Be professional and collaborative. Show them you're a serious buyer who wants to make this work. This is a verbal negotiation - no paperwork or documentation required.

Respond as a thoughtful buyer would. If they're getting closer on price or adding value, express interest. If they're still too high, make a specific counter-offer and explain why.`;

    conversationHistory.push({
      role: 'user',
      content: continuedNegotiationPrompt
    });

    console.log('🤖 Calling AI for continued negotiation...');
    const negotiationContinued = await callLiteLLM(conversationHistory, 1000);

    conversationHistory.push({
      role: 'assistant',
      content: negotiationContinued
    });

    const newValueMatch = negotiationContinued.match(/\$?[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:per|\/)?/i);
    const newValue = newValueMatch ? newValueMatch[0] : 'to be determined';

    sessionState.lastLLMProposedValue = newValue;

    sessionState.negotiationHistory.push({
      proposedBy: 'llm',
      value: newValue,
      timestamp: new Date().toISOString()
    });

    sessionState.priceHistory.push({
      proposedBy: 'llm',
      value: newValue,
      round: Math.ceil(sessionState.negotiationHistory.length / 2)
    });

    console.log(`✅ Continued negotiation generated: ${newValue}`);
    
    res.json({ 
      success: true, 
      message: negotiationContinued,
      dealClosed: false,
      currentProposedValue: sessionState.currentProposedValue
    });
  } catch (error) {
    console.error('❌ Negotiate response error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing negotiation response', 
      error: error.message 
    });
  }
});

// Get current session state
app.get('/api/session-state', (req, res) => {
  res.json({
    effectivenessScore: sessionState.effectivenessScore,
    negotiationPhase: sessionState.negotiationPhase,
    currentProposedValue: sessionState.currentProposedValue,
    dealClosed: sessionState.dealClosed,
    negotiationHistory: sessionState.negotiationHistory
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER — auto-load books first, then listen
// ─────────────────────────────────────────────────────────────────────────────
loadBooksFromUploadsDir().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Books in memory: ${booksContent.length}`);
    console.log(`🔑 API Key configured: ${LITELLM_API_KEY ? 'Yes' : 'No'}`);
    console.log(`📄 pdf-parse loaded: ${typeof pdfParse === 'function' ? 'Yes' : 'No (Type: ' + typeof pdfParse + ')'}`);
    if (!LITELLM_API_KEY) {
      console.warn('⚠️  WARNING: LITELLM_API_KEY not found in .env file');
    }
    if (typeof pdfParse !== 'function') {
      console.error('⚠️  WARNING: pdf-parse is not properly loaded!');
    }
  });
});