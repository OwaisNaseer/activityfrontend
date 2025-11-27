import React, { useState } from 'react'
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
  console.log('result',results)
  const [currentPage, setCurrentPage] = useState(0)  // 0-based index for pagination
  const [error, setError] = useState(null)

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
    setCurrentPage(0)
    setError(null)
    setLoading(false)
  }

  const handleRegenerate = async () => {
    setLoading(true)
    setError(null)

    // Validate required fields (same as handleSubmit)
    if (!formData.subject || formData.subject === 'Select Subject') {
      setError('Please select a subject')
      setLoading(false)
      return
    }

    if (!formData.grade_band || formData.grade_band === 'Select Grade/Band') {
      setError('Please select a grade/band')
      setLoading(false)
      return
    }

    if (!formData.topic_concept.trim()) {
      setError('Please enter a topic/concept')
      setLoading(false)
      return
    }

    if (!formData.available_time || parseInt(formData.available_time) <= 0) {
      setError('Please enter a valid available time (greater than 0)')
      setLoading(false)
      return
    }

    if (!formData.output_language || formData.output_language === 'Select Output Language') {
      setError('Please select an output language')
      setLoading(false)
      return
    }

    // Validate "Other" language
    if (formData.output_language === 'Other' && !formData.languageOther.trim()) {
      setError('Please specify the language')
      setLoading(false)
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

      const requestUrl = getApiUrl('/api/generate-activity')

      const apiResponse = await axios.post(
        requestUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 120000  // Increased timeout for multiple variants
        }
      )

      if (apiResponse.data.success) {
        // Handle both single and multiple variants
        if (apiResponse.data.activities && Array.isArray(apiResponse.data.activities)) {
          setResults(apiResponse.data.activities)
        } else if (apiResponse.data.activity) {
          setResults([apiResponse.data.activity])
        } else {
          setError('No activities received in response')
        }
        setCurrentPage(0)  // Reset to first page
        setError(null)
      } else {
        const errorMsg = apiResponse.data.error || 'Failed to generate activity'
        setError(errorMsg)
      }
    } catch (err) {
      if (err.response) {
        setError(`Server error (${err.response.status}): ${err.response.data.detail || 'Server error occurred'}`)
      } else if (err.request) {
        setError(`Cannot connect to backend server. Please make sure the backend is running on port 8000.`)
      } else {
        setError(`Request error: ${err.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResults([])

    // Validate required fields
    if (!formData.subject || formData.subject === 'Select Subject') {
      setError('Please select a subject')
      setLoading(false)
      return
    }

    if (!formData.grade_band || formData.grade_band === 'Select Grade/Band') {
      setError('Please select a grade/band')
      setLoading(false)
      return
    }

    if (!formData.topic_concept.trim()) {
      setError('Please enter a topic/concept')
      setLoading(false)
      return
    }

    if (!formData.available_time || parseInt(formData.available_time) <= 0) {
      setError('Please enter a valid available time (greater than 0)')
      setLoading(false)
      return
    }

    if (!formData.output_language || formData.output_language === 'Select Output Language') {
      setError('Please select an output language')
      setLoading(false)
      return
    }

    // Validate "Other" language
    if (formData.output_language === 'Other' && !formData.languageOther.trim()) {
      setError('Please specify the language')
      setLoading(false)
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

      const requestUrl = getApiUrl('/api/generate-activity')
      console.log('Making API request to:', requestUrl)
      console.log('Payload:', payload)

      const apiResponse = await axios.post(
        requestUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 120000  // Increased timeout for multiple variants
        }
      )
      
      console.log('API Response received:', apiResponse.data)

      if (apiResponse.data.success) {
        // Handle both single and multiple variants
        if (apiResponse.data.activities && Array.isArray(apiResponse.data.activities)) {
          setResults(apiResponse.data.activities)
        } else if (apiResponse.data.activity) {
          setResults([apiResponse.data.activity])
        } else {
          setError('No activities received in response')
        }
        setCurrentPage(0)  // Reset to first page
        setError(null)
      } else {
        const errorMsg = apiResponse.data.error || 'Failed to generate activity'
        setError(errorMsg)
      }
    } catch (err) {
      console.error('API Error:', err)
      if (err.response) {
        setError(`Server error (${err.response.status}): ${err.response.data?.detail || err.response.data?.error || 'Server error occurred'}`)
      } else if (err.request) {
        console.error('No response received:', err.request)
        setError(`Cannot connect to backend server. Please make sure the backend is running on port 8000.`)
      } else {
        console.error('Request setup error:', err.message)
        setError(`Request error: ${err.message}`)
      }
    } finally {
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
                disabled={loading}
              >
                <span className="star-icon">✕</span>
                Clear
              </button>
              <button
                type="button"
                className="submit-button regenerate-button"
                onClick={handleRegenerate}
                disabled={loading}
                style={{ marginLeft: '10px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Regenerating...
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
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Generating...
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

        {results.length > 0 && (
          <div className="response-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 className="response-title">Generated Lesson Plan:</h3>
              {results.length > 1 && (
                <div className="pagination-info">
                  Variant {currentPage + 1} of {results.length}
                </div>
              )}
            </div>
            
            {results.length > 1 && (
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

            <div className="response-content lesson-plan">
              <div 
                className="lesson-plan-content" 
                dangerouslySetInnerHTML={{__html: formatLessonPlan(results[currentPage])}} 
              />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default ActivityForm

