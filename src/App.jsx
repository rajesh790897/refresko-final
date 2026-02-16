import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Navbar from './components/Navbar/Navbar'
import Hero from './components/Hero/Hero'
import About from './components/About/About'
import Performers from './components/Performers/Performers'
import Events from './components/Events/Events'
import TechTeam from './components/TechTeam/TechTeam'
import FAQ from './components/FAQ/FAQ'
import Footer from './components/Footer/Footer'
import CustomCursor from './components/CustomCursor/CustomCursor'
import ParticleCanvas from './components/ParticleCanvas/ParticleCanvas'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

function App() {
  const mainRef = useRef(null)

  useEffect(() => {
    // Red Shift Glitch Effect
    const glitchInterval = setInterval(() => {
      const container = mainRef.current
      if (container) {
        gsap.to(container, {
          x: -5,
          duration: 0.05,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(container, {
              x: 0,
              duration: 0.1,
              ease: 'elastic.out(1, 0.3)'
            })
          }
        })
      }
    }, Math.random() * 3000 + 5000) // Random interval between 5-8 seconds

    return () => clearInterval(glitchInterval)
  }, [])

  return (
    <div className="app">
      <CustomCursor />
      <ParticleCanvas />
      <div className="hex-grid-overlay" />
      <div ref={mainRef} className="main-content">
        <Navbar />
        <Hero />
        <About />
        <Performers />
        <Events />
        <TechTeam />
        <FAQ />
        <Footer />
      </div>
    </div>
  )
}

export default App
