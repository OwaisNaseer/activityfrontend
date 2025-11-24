import React, { useState } from 'react'
import axios from 'axios'
import './ActivityForm.css'

// In development, use relative URLs (Vite proxy handles it)
// In production, use full URL
const API_BASE_URL = import.meta.env.DEV ? '' : 'http://localhost:8000'

// Helper to get the actual URL to use
const getApiUrl = (path) => {
  const base = API_BASE_URL || ''
  return `${base}${path}`
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
    output_language: ''
  })

  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
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
    'K-2',
    '3-5',
    '6-8',
    '9-12',
    'Elementary',
    'Middle School',
    'High School',
    'All Levels'
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
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResponse(null)

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

    try {
      const payload = {
        subject: formData.subject,
        grade_band: formData.grade_band,
        topic_concept: formData.topic_concept.trim(),
        available_materials: formData.available_materials.trim() || null,
        constraints: formData.constraints.trim() || null,
        available_time: parseInt(formData.available_time),
        output_language: formData.output_language
      }

      const requestUrl = getApiUrl('/api/generate-activity')

      const apiResponse = await axios.post(
        requestUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      )

      if (apiResponse.data.success) {
        setResponse(apiResponse.data.activity)
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

        <div className="form-actions">
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
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {response && (
          <div className="response-container">
            <h3 className="response-title">Generated Lesson Plan:</h3>
            <div className="response-content lesson-plan">
              <div 
                className="lesson-plan-content" 
                dangerouslySetInnerHTML={{__html: formatLessonPlan(response)}} 
              />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

export default ActivityForm

