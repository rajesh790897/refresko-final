import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import './Events.css'

const events = [
  {
    id: 1,
    name: 'ARMAGEDDON',
    description: 'Combat robotics championship with custom bots. Inspired by Transformers, craft machines to defeat opponents.',
    prize: '₹6,00,000',
    category: 'Robotics',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600',
    featured: true
  },
  {
    id: 2,
    name: 'NAVIGP',
    description: 'Autonomous navigation challenge for drones and robots.',
    prize: '₹2,00,000',
    category: 'AI/ML',
    image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400'
  },
  {
    id: 3,
    name: 'CODECHAOS',
    description: '48-hour hackathon to build innovative solutions.',
    prize: '₹3,00,000',
    category: 'Coding',
    image: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400'
  },
  {
    id: 4,
    name: 'SKY MANEUVER',
    description: 'RC plane flying competition with precision challenges.',
    prize: '₹1,50,000',
    category: 'Aero',
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400'
  }
]

const Events = () => {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })

  const featuredEvent = events.find(e => e.featured)
  const gridEvents = events.filter(e => !e.featured)

  return (
    <section id="events" ref={sectionRef} className="events" data-particle-shape="3">
      <motion.h2
        className="section-title events-title"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
      >
        EVENTS
      </motion.h2>

      <div className="events-container">
        {/* Featured Event */}
        <motion.div
          className="featured-event"
          initial={{ opacity: 0, x: -50 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="featured-content">
            <h3 className="featured-name">{featuredEvent.name}</h3>
            <div className="featured-line" />
            <p className="featured-description">{featuredEvent.description}</p>
            <p className="featured-categories">Categories: 8kg, 15kg, 30kg.</p>
            
            <div className="featured-prize">
              <span className="prize-label">PRIZES WORTH:</span>
              <span className="prize-value neon-text">{featuredEvent.prize}</span>
            </div>

            <motion.button
              className="featured-btn interactive"
              whileHover={{ scale: 1.05, x: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              KNOW MORE
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </motion.button>
          </div>
        </motion.div>

        {/* Events Grid */}
        <div className="events-grid">
          {gridEvents.map((event, index) => (
            <motion.div
              key={event.id}
              className="event-card interactive"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
              whileHover={{ y: -10 }}
            >
              <div className="event-image-wrapper">
                <img src={event.image} alt={event.name} className="event-image" />
                <div className="event-category">{event.category}</div>
              </div>
              <div className="event-info">
                <h4 className="event-name">{event.name}</h4>
                <p className="event-prize">{event.prize}</p>
              </div>
              <div className="event-hover-overlay">
                <p>{event.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="view-all-events"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <button className="btn-outline interactive">
          VIEW ALL EVENTS
          <span className="btn-arrow">→</span>
        </button>
      </motion.div>
    </section>
  )
}

export default Events
