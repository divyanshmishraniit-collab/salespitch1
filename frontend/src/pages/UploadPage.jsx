import React, { useState, useRef } from 'react';
import { Upload, BookOpen, Trash2, Eye, Play, FileText } from 'lucide-react';
import './UploadPage.css';

export default function UploadPage({ uploadedBooks, fetchUploadedBooks, onStartSession }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!pdfFiles.length) return alert('Please upload PDF files only.');
    if (pdfFiles.length > 3) return alert('Maximum 3 PDF files at a time.');

    setUploading(true);
    const formData = new FormData();
    pdfFiles.forEach(f => formData.append('pdfs', f));

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/upload-books`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchUploadedBooks();
      } else {
        alert('Upload failed: ' + (data.message || 'Unknown error'));
      }
    } catch {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Remove "${filename}"?`)) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/delete-book/${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) fetchUploadedBooks();
      else alert('Failed to delete: ' + (data.message || 'Unknown error'));
    } catch {
      alert('Failed to delete PDF.');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="upload-page">
      <div className="upload-page-header animate-fadeUp">
        <h2 className="upload-page-title">Knowledge Base</h2>
        <p className="upload-page-sub">
          Upload your sales training PDFs. The AI will learn from them to coach your pitches.
        </p>
      </div>

      <div className="upload-layout">
        {/* Drop Zone */}
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'loading' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />

          {uploading ? (
            <div className="dropzone-uploading">
              <div className="upload-spinner" />
              <p>Processing your books…</p>
            </div>
          ) : (
            <>
              <div className="dropzone-icon">
                <Upload size={28} />
              </div>
              <p className="dropzone-title">
                {isDragging ? 'Drop to upload' : 'Drop PDFs here'}
              </p>
              <p className="dropzone-sub">or click to browse files</p>
              <div className="dropzone-limits">
                <span>PDF only</span>
                <span className="dot-sep">·</span>
                <span>Max 3 files</span>
              </div>
            </>
          )}
        </div>

        {/* Books List */}
        <div className="books-panel">
          <div className="books-panel-header">
            <div className="books-count-badge">
              <BookOpen size={13} />
              <span>{uploadedBooks.length} book{uploadedBooks.length !== 1 ? 's' : ''} loaded</span>
            </div>
          </div>

          {uploadedBooks.length === 0 ? (
            <div className="books-empty">
              <FileText size={32} strokeWidth={1.5} />
              <p>No books uploaded yet</p>
              <span>Upload PDFs to get started</span>
            </div>
          ) : (
            <ul className="books-list">
              {uploadedBooks.map((book, i) => (
                <li key={i} className="book-item animate-fadeUp" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="book-item-icon">
                    <BookOpen size={15} />
                  </div>
                  <span className="book-item-name" title={book}>{book}</span>
                  <div className="book-item-actions">
                    <a
                      href={`${import.meta.env.VITE_BACKEND_URL}/uploads/${encodeURIComponent(book)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="book-action-btn view"
                      title="View PDF"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye size={14} />
                    </a>
                    <button
                      className="book-action-btn delete"
                      title="Remove"
                      onClick={() => handleDelete(book)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {uploadedBooks.length > 0 && (
            <button className="start-session-btn" onClick={onStartSession}>
              <Play size={16} strokeWidth={2.5} />
              Start Practice Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}