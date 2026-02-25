import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Upload, BookOpen, MessageSquare, TrendingUp } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedBooks, setUploadedBooks] = useState([]);

  // Delete a book
  const handleDeleteBook = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/delete-book/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchUploadedBooks();
      } else {
        alert('Failed to delete PDF: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Failed to delete PDF.');
    }
  };

  // Fetch uploaded books from backend
  const fetchUploadedBooks = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/list-books`);
      const data = await res.json();
      if (data.success) {
        setUploadedBooks(data.books);
      } else {
        setUploadedBooks([]);
      }
    } catch (err) {
      setUploadedBooks([]);
    }
  };

  // On mount, fetch uploaded books
  useEffect(() => {
    fetchUploadedBooks();
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [effectivenessScore, setEffectivenessScore] = useState(0);
  const [negotiationPhase, setNegotiationPhase] = useState(false);
  const [currentProposedValue, setCurrentProposedValue] = useState(null);
  const [dealClosed, setDealClosed] = useState(false);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          }
        }
        setTranscript(prev => prev + finalTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        }
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        if (isRecording) {
          recognitionRef.current.start();
        }
      };
    } else {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    }
  }, [isRecording]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      alert('Please upload PDF files only');
      return;
    }
    // Upload logic can be added here
  };

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const analyzePitchFromVoice = async (pitchText) => {
    setIsAnalyzing(true);
    console.log('Starting pitch analysis for:', pitchText.slice(0, 100));

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze-pitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch: pitchText })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Analysis failed');
      }

      console.log('Pitch analysis received');

      setMessages(prev => [
        ...prev,
        { role: 'user', content: pitchText },
        { role: 'assistant', content: data.analysis, type: 'analysis' }
      ]);

      setTranscript('');
    } catch (error) {
      console.error('Pitch analysis error:', error);
      alert('❌ Error analyzing pitch: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeResponse = async (text) => {
    setIsAnalyzing(true);
    console.log('Starting response analysis for:', text.slice(0, 100));

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/analyze-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: text })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Analysis failed');
      }

      console.log('Response analysis received');

      setEffectivenessScore(data.effectivenessScore || 0);

      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.feedback, type: 'feedback' }
      ]);

      if (data.shouldAskNegotiation) {
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: 'I liked your program. Are you ready for negotiation now?',
              type: 'negotiation-prompt'
            }
          ]);
        }, 1000);
      }

      setTranscript('');
    } catch (error) {
      console.error('Analysis error:', error);
      alert('❌ Error analyzing response: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startPitchSession = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      setMessages([
        {
          role: 'assistant',
          content: data.initialPrompt || "Welcome! I'm your AI sales coach. Please start by recording your pitch for the GenAI Training program. Click 'Record Your Pitch' when ready!",
          type: 'intro'
        }
      ]);
      setSessionStarted(true);
      setActiveTab('practice');
    } catch (error) {
      console.error('Session start error:', error);
      alert('❌ Error starting session. Make sure books are uploaded and backend is running.');
    }
  };

  const startFresh = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Welcome! I'm your AI sales coach. Please start by recording your pitch for the GenAI Training program. Click 'Record Your Pitch' when ready!",
        type: 'intro'
      }
    ]);
    setTranscript('');
    setIsAnalyzing(false);
    setIsRecording(false);
    setEffectivenessScore(0);
    setNegotiationPhase(false);
    setCurrentProposedValue(null);
    setDealClosed(false);
  };

  const handleNegotiationResponse = async (text) => {
    setIsAnalyzing(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/start-negotiation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userResponse: text })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to process negotiation response');
      }

      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.message, type: data.negotiationStarted ? 'negotiation' : 'feedback' }
      ]);

      if (data.negotiationStarted) {
        setNegotiationPhase(true);
      }

      setTranscript('');
    } catch (error) {
      console.error('Negotiation response error:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePriceProposal = async (text) => {
    setIsAnalyzing(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/propose-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceProposal: text })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to process price proposal');
      }

      const priceMatch = text.match(/\$?[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:per|\/)?/i);
      const extractedPrice = priceMatch ? priceMatch[0] : text;

      setCurrentProposedValue(extractedPrice);

      setMessages(prev => [
        ...prev,
        { role: 'user', content: `My proposed value: ${text}`, type: 'price-proposal' },
        { role: 'assistant', content: data.counterOffer, type: 'counter-offer' }
      ]);

      setTranscript('');
    } catch (error) {
      console.error('Price proposal error:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNegotiationContinue = async (text) => {
    setIsAnalyzing(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/negotiate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: text })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to process negotiation');
      }

      if (data.dealClosed) {
        setDealClosed(true);
        setCurrentProposedValue(data.finalValue);
      }

      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: data.message, type: data.dealClosed ? 'deal-closed' : 'negotiation' }
      ]);

      setTranscript('');
    } catch (error) {
      console.error('Negotiation continue error:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeClick = () => {
    if (negotiationPhase) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.type === 'negotiation-prompt') {
        handleNegotiationResponse(transcript);
      } else if (lastMsg?.type === 'negotiation' && !currentProposedValue) {
        handlePriceProposal(transcript);
      } else {
        handleNegotiationContinue(transcript);
      }
    } else {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.type === 'negotiation-prompt') {
        handleNegotiationResponse(transcript);
      } else if (messages.length <= 1) {
        analyzePitchFromVoice(transcript);
      } else {
        analyzeResponse(transcript);
      }
    }
  };

  const getMessageBackground = (msg) => {
    if (msg.role === 'user') return '#9333ea';
    switch (msg.type) {
      case 'feedback': return 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
      case 'question': return 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)';
      case 'negotiation-prompt': return 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)';
      case 'counter-offer':
      case 'negotiation': return 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)';
      case 'deal-closed': return 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
      default: return '#334155';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e293b 0%, #7e22ce 50%, #1e293b 100%)',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div />
            {(negotiationPhase || dealClosed) && (
              <div style={{
                background: 'rgba(147, 51, 234, 0.3)',
                border: '2px solid #9333ea',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                color: 'white',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#e9d5ff' }}>Current Proposed Value</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem' }}>
                  {currentProposedValue || 'Pending...'}
                </p>
              </div>
            )}
            <div />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
            🎯 AI Sales Pitch Analyzer
          </h1>
          <p style={{ color: '#e9d5ff', fontSize: '1.1rem' }}>
            Train with sales books • Practice your pitch • Get AI-powered feedback
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'upload' ? '#9333ea' : '#334155',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'upload' ? '0 4px 6px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.3s'
            }}
          >
            <Upload size={20} />
            Upload Books
          </button>
          <button
            onClick={() => setActiveTab('practice')}
            disabled={uploadedBooks.length === 0}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              border: 'none',
              cursor: uploadedBooks.length === 0 ? 'not-allowed' : 'pointer',
              background: activeTab === 'practice' ? '#9333ea' : '#334155',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: uploadedBooks.length === 0 ? 0.5 : 1,
              boxShadow: activeTab === 'practice' ? '0 4px 6px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.3s'
            }}
          >
            <Mic size={20} />
            Practice Pitch
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div style={{
              background: '#1e293b',
              borderRadius: '1rem',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                <BookOpen style={{ color: '#2563eb', marginRight: '1rem' }} size={32} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d6d6dc', margin: 0 }}>
                  Upload Books
                </h2>
              </div>

              {/* Drag & Drop Upload */}
              <div
                style={{
                  border: '2px dashed #e0e7ef',
                  borderRadius: '12px',
                  padding: '2.5rem',
                  textAlign: 'center',
                  marginBottom: '2rem',
                  background: '#fff',
                  cursor: 'pointer',
                  transition: 'border-color 0.3s',
                  position: 'relative',
                  minHeight: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(30,41,59,0.06)'
                }}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <Upload style={{ color: '#2563eb', marginBottom: 16 }} size={48} />
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#22223b', marginBottom: 4 }}>
                  Drag & drop PDF files here or click to upload
                </div>
                <div style={{ color: '#64748b', fontSize: '0.95rem', marginTop: 2 }}>
                  Maximum 3 files • PDF only
                </div>
              </div>

              {uploadedBooks.length > 0 && (
                <div style={{
                  marginBottom: '2rem',
                  background: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(30,41,59,0.06)',
                  padding: '1.5rem 1.5rem 1rem 1.5rem',
                  border: '1px solid #e0e7ef'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#22223b', marginBottom: '1.2rem', display: 'flex', alignItems: 'center' }}>
                    <BookOpen style={{ color: '#2563eb', marginRight: '0.7rem' }} size={22} />
                    Uploaded Books
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {uploadedBooks.map((book, idx) => (
                      <li key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#fff',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        marginBottom: '0.7rem',
                        border: '1px solid #e0e7ef',
                        boxShadow: '0 1px 2px rgba(30,41,59,0.03)'
                      }}>
                        <BookOpen style={{ color: '#2563eb', marginRight: '0.7rem' }} size={20} />
                        <span style={{ flex: 1, fontWeight: 500, color: '#22223b', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {book}
                        </span>
                        <a
                          href={`http://localhost:5000/uploads/${encodeURIComponent(book)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: '#f1f5f9',
                            color: '#2563eb',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '0.35rem 1.1rem',
                            fontWeight: 600,
                            fontSize: '0.97rem',
                            marginRight: '0.7rem',
                            textDecoration: 'none',
                            transition: 'background 0.2s'
                          }}
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleDeleteBook(book)}
                          title="Remove PDF"
                          style={{
                            background: '#fff',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '0.35rem 1.1rem',
                            fontWeight: 600,
                            fontSize: '0.97rem',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {uploadedBooks.length > 0 && (
                <button
                  onClick={startPitchSession}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
                    color: 'white',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  🚀 Start Practice Session
                </button>
              )}
            </div>
          </div>
        )}

        {/* Practice Tab */}
        {activeTab === 'practice' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{
              background: '#1e293b',
              borderRadius: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.5rem',
                background: '#0f172a',
                borderBottom: '1px solid #334155'
              }}>
                <h3 style={{ color: 'white', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
                  Practice Session
                </h3>
                <button
                  onClick={startFresh}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  🔄 Start Fresh
                </button>
              </div>

              {/* Chat Messages */}
              <div style={{
                height: '500px',
                overflowY: 'auto',
                padding: '1.5rem',
                background: '#0f172a'
              }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: '3rem' }}>
                    <MessageSquare style={{ margin: '0 auto 1rem' }} size={48} />
                    <p>Click "Start Practice Session" to begin</p>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: '1rem'
                    }}
                  >
                    <div style={{
                      maxWidth: '80%',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      background: getMessageBackground(msg),
                      color: 'white'
                    }}>
                      {msg.type === 'feedback' && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <TrendingUp size={20} style={{ marginRight: '0.5rem' }} />
                          <span style={{ fontWeight: '600' }}>Feedback:</span>
                        </div>
                      )}
                      {msg.type === 'negotiation-prompt' && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '600' }}>💼 Ready for negotiation?</span>
                        </div>
                      )}
                      {msg.type === 'counter-offer' && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '600' }}>💰 Counter Offer:</span>
                        </div>
                      )}
                      {msg.type === 'deal-closed' && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: '600' }}>🎉 Deal Closed!</span>
                        </div>
                      )}
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}

                {isAnalyzing && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      background: '#334155',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      display: 'flex',
                      gap: '0.5rem'
                    }}>
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <div key={i} style={{
                          width: '8px',
                          height: '8px',
                          background: '#9333ea',
                          borderRadius: '50%',
                          animation: `bounce 1s infinite ${delay}s`
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              {messages.length > 0 && !dealClosed && (
                <div style={{
                  padding: '1.5rem',
                  background: '#1e293b',
                  borderTop: '1px solid #334155'
                }}>
                  {transcript && (
                    <div style={{
                      background: '#334155',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        Live Transcript:
                      </p>
                      <p style={{ color: 'white', margin: 0 }}>{transcript}</p>
                    </div>
                  )}

                  {!isRecording ? (
                    <>
                      {transcript && !isAnalyzing && (
                        <button
                          onClick={handleAnalyzeClick}
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                            color: 'white',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            marginBottom: '1rem',
                            transition: 'transform 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          🔍 {messages.length <= 1 ? 'Analyze Pitch' : negotiationPhase ? 'Submit' : 'Analyze Response'}
                        </button>
                      )}

                      <button
                        onClick={startRecording}
                        disabled={isAnalyzing}
                        style={{
                          width: '100%',
                          background: isAnalyzing ? '#6b7280' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                          color: 'white',
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                          border: 'none',
                          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          transition: 'transform 0.2s',
                          opacity: isAnalyzing ? 0.5 : 1
                        }}
                        onMouseOver={(e) => !isAnalyzing && (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <Mic size={24} />
                        {transcript ? 'Record Again' : messages.length <= 1 ? 'Record Your Pitch' : negotiationPhase ? 'Record Your Response' : 'Record Your Answer'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={stopRecording}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #dc2626 0%, #ec4899 100%)',
                        color: 'white',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        animation: 'pulse 2s infinite'
                      }}
                    >
                      <MicOff size={24} />
                      Stop Recording
                    </button>
                  )}

                  <p style={{
                    color: '#94a3b8',
                    fontSize: '0.875rem',
                    textAlign: 'center',
                    marginTop: '1rem',
                    marginBottom: 0
                  }}>
                    {isAnalyzing
                      ? '🤖 AI is analyzing...'
                      : isRecording
                        ? '🎤 Recording in progress... Speak naturally!'
                        : transcript
                          ? '✅ Recording complete. Click "Submit" to proceed'
                          : negotiationPhase
                            ? '💰 Discuss the price and counter-offers'
                            : messages.length <= 1
                              ? '🎯 Click to record your GenAI Training pitch'
                              : '💬 Click to answer the question'}
                  </p>
                </div>
              )}

              {/* Deal Closed View */}
              {dealClosed && (
                <div style={{
                  padding: '2rem',
                  background: '#1e293b',
                  borderTop: '1px solid #334155',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#e9d5ff', margin: '0 0 1rem 0' }}>
                    Congratulations! You've successfully completed the sales negotiation simulation.
                  </p>
                  <button
                    onClick={startFresh}
                    style={{
                      background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
                      color: 'white',
                      padding: '1rem 2rem',
                      borderRadius: '0.5rem',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                      transition: 'transform 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    🔄 Start Another Session
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        width: '100%',
        background: '#f5e9da',
        borderTop: '1px solid #e0e7ef',
        padding: '0.75rem 2rem',
        textAlign: 'center',
        color: '#7c6f57',
        fontSize: '0.95rem',
        marginTop: 'auto'
      }}>
        &copy; {new Date().getFullYear()} NIIT Limited. All rights reserved.
      </footer>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default App;