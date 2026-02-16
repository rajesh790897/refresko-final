import { useState } from 'react'
import { motion } from 'framer-motion'
import './Analytics.css'

// Sample analytics data - Replace with actual API data
const departmentData = [
  { department: 'Computer Science', count: 45, revenue: 22500 },
  { department: 'Electrical Engineering', count: 32, revenue: 16000 },
  { department: 'Mechanical Engineering', count: 28, revenue: 14000 },
  { department: 'Civil Engineering', count: 18, revenue: 9000 },
  { department: 'Electronics & Communication', count: 25, revenue: 12500 },
  { department: 'Information Technology', count: 38, revenue: 19000 }
]

const yearData = [
  { year: '1st Year', count: 35, revenue: 17500 },
  { year: '2nd Year', count: 52, revenue: 26000 },
  { year: '3rd Year', count: 48, revenue: 24000 },
  { year: '4th Year', count: 51, revenue: 25500 }
]

const eventData = [
  { event: 'Coding Competition', registrations: 42 },
  { event: 'Robo Wars', registrations: 28 },
  { event: 'Design Challenge', registrations: 35 },
  { event: 'Cultural Performance', registrations: 18 },
  { event: 'Dance Competition', registrations: 22 },
  { event: 'Gaming Tournament', registrations: 31 }
]

const Analytics = () => {
  const [selectedView, setSelectedView] = useState('department')

  const totalParticipants = departmentData.reduce((sum, d) => sum + d.count, 0)
  const maxDeptCount = Math.max(...departmentData.map(d => d.count))
  const maxYearCount = Math.max(...yearData.map(d => d.count))
  const maxEventCount = Math.max(...eventData.map(e => e.registrations))

  return (
    <div className="analytics">
      {/* Overview Stats */}
      <div className="analytics-overview">
        <motion.div
          className="overview-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="overview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="overview-content">
            <h3>Total Participants</h3>
            <p className="overview-value">{totalParticipants}</p>
          </div>
        </motion.div>

        <motion.div
          className="overview-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="overview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="overview-content">
            <h3>Total Events</h3>
            <p className="overview-value">{eventData.length}</p>
          </div>
        </motion.div>

        <motion.div
          className="overview-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="overview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div className="overview-content">
            <h3>Avg. Per Event</h3>
            <p className="overview-value">{Math.round(totalParticipants / eventData.length)}</p>
          </div>
        </motion.div>
      </div>

      {/* View Selector */}
      <motion.div
        className="view-selector"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <button
          className={`view-btn ${selectedView === 'department' ? 'active' : ''}`}
          onClick={() => setSelectedView('department')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          By Department
        </button>
        <button
          className={`view-btn ${selectedView === 'year' ? 'active' : ''}`}
          onClick={() => setSelectedView('year')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          By Year
        </button>
        <button
          className={`view-btn ${selectedView === 'event' ? 'active' : ''}`}
          onClick={() => setSelectedView('event')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          By Event
        </button>
      </motion.div>

      {/* Charts */}
      {selectedView === 'department' && (
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="chart-header">
            <h2>Department-wise Analysis</h2>
            <p>Participation distribution across departments</p>
          </div>

          <div className="bar-chart">
            {departmentData.map((item, index) => (
              <motion.div
                key={item.department}
                className="bar-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="bar-label">
                  <span className="label-text">{item.department}</span>
                  <span className="label-count">{item.count}</span>
                </div>
                <div className="bar-track">
                  <motion.div
                    className="bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / maxDeptCount) * 100}%` }}
                    transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                  >
                    <span className="bar-percentage">
                      {Math.round((item.count / totalParticipants) * 100)}%
                    </span>
                  </motion.div>
                </div>
                <div className="bar-revenue">
                  Revenue: ₹{item.revenue.toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {selectedView === 'year' && (
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="chart-header">
            <h2>Year-wise Analysis</h2>
            <p>Participation distribution across academic years</p>
          </div>

          <div className="bar-chart">
            {yearData.map((item, index) => (
              <motion.div
                key={item.year}
                className="bar-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="bar-label">
                  <span className="label-text">{item.year}</span>
                  <span className="label-count">{item.count}</span>
                </div>
                <div className="bar-track">
                  <motion.div
                    className="bar-fill year"
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / maxYearCount) * 100}%` }}
                    transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                  >
                    <span className="bar-percentage">
                      {Math.round((item.count / totalParticipants) * 100)}%
                    </span>
                  </motion.div>
                </div>
                <div className="bar-revenue">
                  Revenue: ₹{item.revenue.toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {selectedView === 'event' && (
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="chart-header">
            <h2>Event-wise Analysis</h2>
            <p>Registration distribution across events</p>
          </div>

          <div className="bar-chart">
            {eventData.map((item, index) => (
              <motion.div
                key={item.event}
                className="bar-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="bar-label">
                  <span className="label-text">{item.event}</span>
                  <span className="label-count">{item.registrations}</span>
                </div>
                <div className="bar-track">
                  <motion.div
                    className="bar-fill event"
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.registrations / maxEventCount) * 100}%` }}
                    transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                  >
                    <span className="bar-percentage">
                      {Math.round((item.registrations / totalParticipants) * 100)}%
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Export Options */}
      <motion.div
        className="export-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <h3>Export Analytics</h3>
        <div className="export-buttons">
          <button className="export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download as PDF
          </button>
          <button className="export-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Download as CSV
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default Analytics
