import React, { useState } from 'react'
import ActivityForm from './components/ActivityForm'
import './App.css'

function App() {
  return (
    <div className="app">
      <div className="container">
        <h1 className="title">CONFIGURE</h1>
        <h2 className="subtitle">Input Details</h2>
        <ActivityForm />
      </div>
    </div>
  )
}

export default App

