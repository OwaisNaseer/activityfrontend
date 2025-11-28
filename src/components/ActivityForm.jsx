import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './ActivityForm.css'

// Use full URL to backend - proxy may not be working reliably
const API_BASE_URL = 'http://localhost:8000'

// Helper to get the actual URL to use
const getApiUrl = (path) => {
  const url = `${API_BASE_URL}${path}`
  console.log('API URL:', url)
  return url
}

// Helper function to format lesson plan text
const formatLessonPlan = (text) => {
  if (!text) return ''
  
  // Convert markdown-style headers to HTML
  let formatted = text
    .replace(/^# (.+)$/gm, '<h1 class="lesson-title">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="lesson-section">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="lesson-subsection">$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4 class="lesson-subsubsection">$1</h4>')
  
  // Convert bullet points
  formatted = formatted.replace(/^- (.+)$/gm, '<li class="lesson-point">$1</li>')
  
  // Wrap consecutive list items in ul tags
  formatted = formatted.replace(/(<li class="lesson-point">.*<\/li>\n?)+/g, (match) => {
    return '<ul class="lesson-list">' + match + '</ul>'
  })
  
  // Convert bold text
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  
  // Convert numbered lists
  formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li class="lesson-point">$1</li>')
  
  // Split into paragraphs and format
  const lines = formatted.split('\n')
  const formattedLines = []
  let inList = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('<')) {
      // Already formatted HTML
      if (line.includes('</ul>')) {
        inList = false
      } else if (line.includes('<ul')) {
        inList = true
      }
      formattedLines.push(line)
    } else if (line) {
      // Regular text line
      if (!inList && !line.startsWith('<')) {
        formattedLines.push(`<p class="lesson-paragraph">${line}</p>`)
      } else {
        formattedLines.push(line)
      }
    }
  }
  
  return formattedLines.join('\n')
}

const ActivityForm = () => {
  const [formData, setFormData] = useState({
    subject: '',
    grade_band: '',
    topic_concept: '',
    available_materials: '',
    constraints: '',
    available_time: '',
    output_language: '',
    standard: '',
    languageOther: '',
    num_variants: 1
  })

  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])  // Array to store variants
  const [streamingTexts, setStreamingTexts] = useState([''])  // Array of streaming texts for each variant
  const [currentStreamingVariant, setCurrentStreamingVariant] = useState(0)  // Which variant is currently streaming
  const [isStreaming, setIsStreaming] = useState(false)  // Whether currently streaming
  const [isThinking, setIsThinking] = useState(false)  // Whether LLM is thinking (before content starts)
  const [currentPage, setCurrentPage] = useState(0)  // 0-based index for pagination
  const [error, setError] = useState(null)
  const [variantTransition, setVariantTransition] = useState(false)  // Smooth transition between variants
  const responseContainerRef = useRef(null)  // Ref for auto-scrolling

  const subjects = [
    'Select Subject',
    'Mathematics',
    'Science',
    'English',
    'History',
    'Geography',
    'Art',
    'Music',
    'Physical Education',
    'Computer Science',
    'Other'
  ]

  const grades = [
    'Select Grade/Band',
    'Pre-K',
    'Kindergarten',
    '1st grade',
    '2nd grade',
    '3rd grade',
    '4th grade',
    '5th grade',
    '6th grade',
    '7th grade',
    '8th grade',
    '9th grade',
    '10th grade',
    '11th grade',
    '12th grade',
    'University',
    'Professional Staff',
    'Year 1',
    'Year 2',
    'Year 3',
    'Year 4',
    'Year 5',
    'Year 6',
    'Year 7',
    'Year 8',
    'Year 9',
    'Year 10',
    'Year 11',
    'Year 12',
    'Year 13'
  ]

  const languages = [
    'Select Output Language',
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Chinese',
    'Japanese',
    'Other'
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user changes language from "Other" to something else
    if (name === 'output_language' && value !== 'Other' && error && error.includes('specify the language')) {
      setError(null)
    }
  }

  const handlePageChange = (direction) => {
    if (direction === 'prev' && currentPage > 0) {
      setCurrentPage(currentPage - 1)
    } else if (direction === 'next' && currentPage < results.length - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handleClear = () => {
    // Reset everything to initial state
    setFormData({
      subject: '',
      grade_band: '',
      topic_concept: '',
      available_materials: '',
      constraints: '',
      available_time: '',
      output_language: '',
      standard: '',
      languageOther: '',
      num_variants: 1
    })
    setResults([])
    setStreamingTexts([''])
    setCurrentStreamingVariant(0)
    setIsStreaming(false)
    setCurrentPage(0)
    setError(null)
    setLoading(false)
  }

  // Auto-scroll to bottom when streaming text updates (like ChatGPT)
  useEffect(() => {
    if (isStreaming && responseContainerRef.current) {
      const container = responseContainerRef.current
      // Check if user is near bottom (within 150px) - if so, auto-scroll
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
      if (isNearBottom) {
        // Instant scroll for real-time feel (like ChatGPT)
        requestAnimationFrame(() => {
          if (responseContainerRef.current) {
            responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight
          }
        })
      }
    }
  }, [streamingTexts, currentStreamingVariant, isStreaming])

  const handleRegenerate = async () => {
    setLoading(true)
    setError(null)
    setResults([])
    const numVariants = parseInt(formData.num_variants) || 1
    setStreamingTexts(Array(numVariants).fill(''))
    setCurrentStreamingVariant(0)
    setIsStreaming(true)

    // Validate required fields (same as handleSubmit)
    if (!formData.subject || formData.subject === 'Select Subject') {
      setError('Please select a subject')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.grade_band || formData.grade_band === 'Select Grade/Band') {
      setError('Please select a grade/band')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.topic_concept.trim()) {
      setError('Please enter a topic/concept')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.available_time || parseInt(formData.available_time) <= 0) {
      setError('Please enter a valid available time (greater than 0)')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.output_language || formData.output_language === 'Select Output Language') {
      setError('Please select an output language')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    // Validate "Other" language
    if (formData.output_language === 'Other' && !formData.languageOther.trim()) {
      setError('Please specify the language')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    try {
      const payload = {
        subject: formData.subject,
        grade_band: formData.grade_band,
        topic_concept: formData.topic_concept.trim(),
        available_materials: formData.available_materials.trim() || null,
        constraints: formData.constraints.trim() || null,
        available_time: parseInt(formData.available_time),
        output_language: formData.output_language,
        standard: formData.standard.trim() || null,
        language: formData.output_language === 'Other' ? formData.languageOther.trim() : null,
        num_variants: parseInt(formData.num_variants) || 1,
        regenerate: true
      }

      const requestUrl = getApiUrl('/api/generate-activity-stream')
      console.log('Making streaming API request to:', requestUrl)

      const response = await fetch(requestUrl, {
        method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const numVariants = parseInt(formData.num_variants) || 1
      const accumulatedTexts = Array(numVariants).fill('')
      let currentVariant = 0
      
      // Initialize streaming texts array with correct size
      setStreamingTexts(Array(numVariants).fill(''))
      setIsThinking(true)  // Show thinking indicator initially

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'error') {
                setError(data.content)
                setIsStreaming(false)
                setIsThinking(false)
                setLoading(false)
                return
              } else if (data.type === 'variant_separator') {
                // New variant starting - switch immediately, no blocking
                currentVariant = data.variant - 1
                setCurrentStreamingVariant(currentVariant)
                setIsThinking(false)  // Content is starting
                setIsStreaming(true)
                setVariantTransition(false)  // No transition blocking
                
                setStreamingTexts(prev => {
                  const newTexts = [...prev]
                  if (newTexts.length <= currentVariant) {
                    // Expand array if needed
                    while (newTexts.length <= currentVariant) {
                      newTexts.push('')
                    }
                  }
                  newTexts[currentVariant] = ''
                  return newTexts
                })
                // Reset accumulated text for new variant
                if (accumulatedTexts.length <= currentVariant) {
                  while (accumulatedTexts.length <= currentVariant) {
                    accumulatedTexts.push('')
                  }
                } else {
                  accumulatedTexts[currentVariant] = ''
                }
                
                // Scroll to top smoothly for new variant (non-blocking)
                if (responseContainerRef.current) {
                  setTimeout(() => {
                    if (responseContainerRef.current) {
                      responseContainerRef.current.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                      })
                    }
                  }, 100)
                }
              } else if (data.type === 'content') {
                // Real-time content streaming (like OpenAI) - show immediately
                setIsThinking(false)
                setIsStreaming(true)
                setVariantTransition(false)  // No transition blocking
                
                const variantIdx = (data.variant || currentVariant + 1) - 1
                if (variantIdx < 0 || variantIdx >= accumulatedTexts.length) {
                  console.warn('Invalid variant index:', variantIdx, 'for', accumulatedTexts.length, 'variants')
                  // Expand arrays if needed
                  while (accumulatedTexts.length <= variantIdx) {
                    accumulatedTexts.push('')
                  }
                  setStreamingTexts(prev => {
                    const newTexts = [...prev]
                    while (newTexts.length <= variantIdx) {
                      newTexts.push('')
                    }
                    return newTexts
                  })
                }
                
                // Append content in real-time (no delays)
                accumulatedTexts[variantIdx] += data.content
                setStreamingTexts(prev => {
                  const newTexts = [...prev]
                  if (newTexts.length <= variantIdx) {
                    while (newTexts.length <= variantIdx) {
                      newTexts.push('')
                    }
                  }
                  newTexts[variantIdx] = accumulatedTexts[variantIdx]
                  return newTexts
                })
                setCurrentStreamingVariant(variantIdx)
              } else if (data.type === 'status') {
                // Status updates - show what's happening in backend
                setIsThinking(data.content && data.content.includes('Generating'))
                if (data.content && !data.content.includes('Generating')) {
                  console.log('Status:', data.content, 'for variant', data.variant || 'all')
                }
              } else if (data.type === 'variant_complete') {
                // Variant complete, save it
                const variantIdx = data.variant - 1
                setResults(prev => {
                  const newResults = [...prev]
                  if (newResults.length <= variantIdx) {
                    while (newResults.length <= variantIdx) {
                      newResults.push('')
                    }
                  }
                  newResults[variantIdx] = accumulatedTexts[variantIdx]
                  return newResults
                })
              } else if (data.type === 'done') {
                // All streaming complete - properly reset all states
                const finalResults = accumulatedTexts.filter(text => text.length > 0)
                console.log('Done event received. Final results:', finalResults.map(t => t.length))
                setResults(finalResults)
                setCurrentPage(0)
                setIsStreaming(false)
                setIsThinking(false)
                setLoading(false)
                // Ensure we don't continue processing
                return
              } else if (data.type === 'status') {
                // Status updates - might indicate thinking
                if (data.content && data.content.includes('Generating')) {
                  setIsThinking(true)
                }
                console.log('Status:', data.content)
        } else {
                console.log('Unknown event type:', data.type, data)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, line)
            }
          }
        }
      }

      // Finalize if streaming completed without 'done' event
      console.log('Streaming completed. Accumulated texts:', accumulatedTexts.map(t => t.length))
      const finalResults = accumulatedTexts.filter(text => text.length > 0)
      if (finalResults.length > 0) {
        console.log('Setting results with', finalResults.length, 'variants')
        setResults(finalResults)
        setCurrentPage(0)
      } else {
        console.warn('No content accumulated! Check backend logs.')
        setError('No content was generated. Please check the console for errors.')
      }
      // Always reset all states when stream ends
      setIsStreaming(false)
      setIsThinking(false)
      setLoading(false)

    } catch (err) {
      console.error('Streaming Error:', err)
      setError(`Error: ${err.message}`)
      setIsStreaming(false)
      setIsThinking(false)
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResults([])
    const numVariants = parseInt(formData.num_variants) || 1
    setStreamingTexts(Array(numVariants).fill(''))
    setCurrentStreamingVariant(0)
    setIsStreaming(true)

    // Validate required fields
    if (!formData.subject || formData.subject === 'Select Subject') {
      setError('Please select a subject')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.grade_band || formData.grade_band === 'Select Grade/Band') {
      setError('Please select a grade/band')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.topic_concept.trim()) {
      setError('Please enter a topic/concept')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.available_time || parseInt(formData.available_time) <= 0) {
      setError('Please enter a valid available time (greater than 0)')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    if (!formData.output_language || formData.output_language === 'Select Output Language') {
      setError('Please select an output language')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    // Validate "Other" language
    if (formData.output_language === 'Other' && !formData.languageOther.trim()) {
      setError('Please specify the language')
      setLoading(false)
      setIsStreaming(false)
      return
    }

    try {
      const payload = {
        subject: formData.subject,
        grade_band: formData.grade_band,
        topic_concept: formData.topic_concept.trim(),
        available_materials: formData.available_materials.trim() || null,
        constraints: formData.constraints.trim() || null,
        available_time: parseInt(formData.available_time),
        output_language: formData.output_language,
        standard: formData.standard.trim() || null,
        language: formData.output_language === 'Other' ? formData.languageOther.trim() : null,
        num_variants: parseInt(formData.num_variants) || 1,
        regenerate: false
      }

      const requestUrl = getApiUrl('/api/generate-activity-stream')
      console.log('Making streaming API request to:', requestUrl)
      console.log('Payload:', payload)

      const response = await fetch(requestUrl, {
        method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const numVariants = parseInt(formData.num_variants) || 1
      const accumulatedTexts = Array(numVariants).fill('')
      let currentVariant = 0

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'error') {
                setError(data.content)
                setIsStreaming(false)
                setLoading(false)
                return
              } else if (data.type === 'variant_separator') {
                // New variant starting
                currentVariant = data.variant - 1
                setCurrentStreamingVariant(currentVariant)
                setStreamingTexts(prev => {
                  const newTexts = [...prev]
                  newTexts[currentVariant] = ''
                  return newTexts
                })
              } else if (data.type === 'content') {
                // Content for current variant
                const variantIdx = (data.variant || currentVariant + 1) - 1
                accumulatedTexts[variantIdx] += data.content
                setStreamingTexts(prev => {
                  const newTexts = [...prev]
                  newTexts[variantIdx] = accumulatedTexts[variantIdx]
                  return newTexts
                })
                setCurrentStreamingVariant(variantIdx)
              } else if (data.type === 'variant_complete') {
                // Variant complete, save it
                const variantIdx = data.variant - 1
                setResults(prev => {
                  const newResults = [...prev]
                  newResults[variantIdx] = accumulatedTexts[variantIdx]
                  return newResults
                })
              } else if (data.type === 'done') {
                // All streaming complete - properly reset all states
                // Ensure all variants are saved
                const finalResults = accumulatedTexts.filter(text => text.length > 0)
                setResults(finalResults)
                setCurrentPage(0)
                setIsStreaming(false)
                setIsThinking(false)
                setLoading(false)
                // Ensure we don't continue processing
                return
              } else if (data.type === 'status') {
                // Status updates - show what's happening in backend (real-time)
                setIsThinking(data.content && data.content.includes('Generating'))
                if (data.content && !data.content.includes('Generating')) {
                  console.log('Status:', data.content, 'for variant', data.variant || 'all')
                }
        } else {
                console.log('Unknown event type:', data.type, data)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, line)
              // Don't stop on parse errors, just log them
            }
          }
        }
      }

      // Finalize if streaming completed without 'done' event
      console.log('Streaming completed. Accumulated texts:', accumulatedTexts.map(t => t.length))
      const finalResults = accumulatedTexts.filter(text => text.length > 0)
      if (finalResults.length > 0) {
        console.log('Setting results with', finalResults.length, 'variants')
        setResults(finalResults)
        setCurrentPage(0)
      } else {
        console.warn('No content accumulated! Check backend logs.')
        setError('No content was generated. Please check the console for errors.')
      }
      // Always reset all states when stream ends
      setIsStreaming(false)
      setIsThinking(false)
      setLoading(false)

    } catch (err) {
      console.error('Streaming Error:', err)
      setError(`Error: ${err.message}`)
      setIsStreaming(false)
      setIsThinking(false)
      setLoading(false)
    }
  }

  return (
    <div className="activity-form-container">
      <form onSubmit={handleSubmit} className="activity-form">
        <div className="form-grid">
          {/* Left Column */}
          <div className="form-column">
            <div className="form-group">
              <label htmlFor="subject">
                Subject <span className="required">*</span>
              </label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="form-input"
              >
                {subjects.map(subject => (
                  <option key={subject} value={subject === 'Select Subject' ? '' : subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="topic_concept">
                Topic/Concept <span className="required">*</span>
              </label>
              <input
                type="text"
                id="topic_concept"
                name="topic_concept"
                value={formData.topic_concept}
                onChange={handleChange}
                placeholder="e.g., Photosynthesis"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="available_materials">Available Materials</label>
              <textarea
                id="available_materials"
                name="available_materials"
                value={formData.available_materials}
                onChange={handleChange}
                placeholder="Paper, markers, projector..."
                rows="4"
                className="form-input form-textarea"
              />
            </div>

            <div className="form-group">
              <label htmlFor="standard">Standard</label>
              <input
                type="text"
                id="standard"
                name="standard"
                value={formData.standard}
                onChange={handleChange}
                placeholder="e.g., CCSS.MATH.CONTENT.3.OA.A.1"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="output_language">
                Output Language <span className="required">*</span>
              </label>
              <select
                id="output_language"
                name="output_language"
                value={formData.output_language}
                onChange={handleChange}
                required
                className="form-input"
              >
                {languages.map(lang => (
                  <option key={lang} value={lang === 'Select Output Language' ? '' : lang}>
                    {lang}
                  </option>
                ))}
              </select>
              {formData.output_language === 'Other' && (
                <div className="form-group" style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    id="languageOther"
                    name="languageOther"
                    value={formData.languageOther}
                    onChange={handleChange}
                    placeholder="Enter language"
                    className="form-input"
                    required
                  />
                  {error && error.includes('specify the language') && (
                    <div className="inline-error">Please specify the language.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="form-column">
            <div className="form-group">
              <label htmlFor="grade_band">
                Grade/Band <span className="required">*</span>
              </label>
              <select
                id="grade_band"
                name="grade_band"
                value={formData.grade_band}
                onChange={handleChange}
                required
                className="form-input"
              >
                {grades.map(grade => (
                  <option key={grade} value={grade === 'Select Grade/Band' ? '' : grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="available_time">
                Available Time (min) <span className="required">*</span>
              </label>
              <input
                type="number"
                id="available_time"
                name="available_time"
                value={formData.available_time}
                onChange={handleChange}
                placeholder="e.g., 45"
                min="1"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="constraints">Constraints</label>
              <textarea
                id="constraints"
                name="constraints"
                value={formData.constraints}
                onChange={handleChange}
                placeholder="No lab equipment / large class / limited devices"
                rows="4"
                className="form-input form-textarea"
              />
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <label htmlFor="num_variants">Number of Variants</label>
          <select
            id="num_variants"
            name="num_variants"
            value={formData.num_variants}
            onChange={handleChange}
            className="form-input"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>

        <div className="form-actions">
          {results.length > 0 ? (
            <>
              <button
                type="button"
                className="submit-button clear-button"
                onClick={handleClear}
                disabled={loading || isStreaming}
              >
                <span className="star-icon">✕</span>
                Clear
              </button>
              <button
                type="button"
                className="submit-button regenerate-button"
                onClick={handleRegenerate}
                disabled={loading || isStreaming}
                style={{ marginLeft: '10px' }}
              >
                {(loading || isStreaming) ? (
                  <>
                    <span className="spinner"></span>
                    {isStreaming ? 'Generating...' : 'Regenerating...'}
                  </>
                ) : (
                  <>
                    <span className="star-icon">↻</span>
                    Regenerate
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="submit"
              className="submit-button"
              disabled={loading || isStreaming}
            >
              {(loading || isStreaming) ? (
                <>
                  <span className="spinner"></span>
                  {isStreaming ? 'Generating...' : 'Preparing...'}
                </>
              ) : (
                <>
                  <span className="star-icon">★</span>
                  Generate professional output
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {(isStreaming || results.length > 0) && (
          <div className="response-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="response-title">Generated Lesson Plan:</h3>
              {!isStreaming && results.length > 1 && (
                <div className="pagination-info">
                  Variant {currentPage + 1} of {results.length}
                </div>
              )}
              {(isStreaming || isThinking || loading) && (
                <div className="pagination-info status-indicator">
                  {isThinking && !isStreaming ? (
                    <span className="thinking-indicator">
                      <span className="thinking-dot"></span>
                      <span className="thinking-dot"></span>
                      <span className="thinking-dot"></span>
                      <span style={{ marginLeft: '8px' }}>Thinking...</span>
                    </span>
                  ) : isStreaming ? (
                    <>
                      <span className="spinner" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                      <span>Generating variant {currentStreamingVariant + 1} of {Math.max(streamingTexts.length, parseInt(formData.num_variants) || 1)}...</span>
                    </>
                  ) : loading ? (
                    <>
                      <span className="spinner" style={{ display: 'inline-block', marginRight: '8px' }}></span>
                      <span>Preparing...</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
            
            {!isStreaming && results.length > 1 && (
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => handlePageChange('prev')}
                  disabled={currentPage === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() => handlePageChange('next')}
                  disabled={currentPage === results.length - 1}
                >
                  Next
                </button>
              </div>
            )}

            <div className="response-content lesson-plan" ref={responseContainerRef}>
              {isThinking && !isStreaming ? (
                <div className="thinking-container">
                  <div className="thinking-message">
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                    <span style={{ marginLeft: '12px' }}>Preparing your lesson plan...</span>
                  </div>
                </div>
              ) : isStreaming ? (
                <div className="lesson-plan-content streaming-content">
                  <div 
                    dangerouslySetInnerHTML={{__html: formatLessonPlan(streamingTexts[currentStreamingVariant] || '')}} 
                  />
                </div>
              ) : results.length > 0 ? (
                <div 
                  className="lesson-plan-content completed-content" 
                  dangerouslySetInnerHTML={{__html: formatLessonPlan(results[currentPage])}} 
                />
              ) : null}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default ActivityForm

