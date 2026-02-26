import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { cpanelApi } from '../lib/cpanelApi'
import { getActivePaymentOption, loadPaymentConfig } from '../lib/paymentConfig'
import { loadPaymentConfigWithApi } from '../lib/paymentConfigApi'
import './SKFDashboard.css'

// Default data structure
const defaultStudentData = {
  name: 'John Doe',
  studentId: 'BTECH\\2022\\CSE\\0001',
  email: 'john.doe@skf.edu',
  department: 'Computer Science',
  year: '3rd Year',
  phone: '+91 98765 43210',
  avatar: null,
  registeredEvents: ['Tech Quiz', 'Hackathon'],
  contributionStatus: 'Volunteer'
}

const SKFDashboard = () => {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('home')
  const [student, setStudent] = useState(defaultStudentData)
  const [latestPayment, setLatestPayment] = useState(null)
  const [showFoodModal, setShowFoodModal] = useState(false)
  const [foodPreference, setFoodPreference] = useState('')
  const [gatePassQrCodeUrl, setGatePassQrCodeUrl] = useState('')
  const [paymentConfig, setPaymentConfig] = useState(() => loadPaymentConfig())

  const activePaymentOption = useMemo(
    () => getActivePaymentOption(paymentConfig),
    [paymentConfig]
  )
  const configuredPaymentAmount = Number(activePaymentOption?.amount) || 500
  const isFoodIncluded = Boolean(activePaymentOption?.includeFood)

  // Fetch payment status from database (cross-device sync)
  const fetchPaymentStatusFromDatabase = async (studentCode) => {
    if (!studentCode) return null

    try {
      let studentRecord = null

      if (isSupabaseConfigured && supabase) {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('payment_completion, gate_pass_created, payment_approved')
          .eq('student_code', studentCode.trim().toUpperCase())
          .single()

        if (!studentError && studentData) {
          studentRecord = studentData
        }
      }

      // Try cPanel API first
      if (cpanelApi.isConfigured()) {
        try {
          const response = await cpanelApi.listPayments()
          if (response.success && Array.isArray(response.payments)) {
            const studentPayment = response.payments
              .filter(p => (p.student_code || '').trim().toUpperCase() === studentCode.trim().toUpperCase())
              .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
            
            if (studentPayment) {
              return {
                status: studentPayment.status,
                payment_approved: studentRecord?.payment_approved || studentPayment.payment_approved,
                payment_completion: Boolean(studentRecord?.payment_completion),
                amount: studentPayment.amount,
                utrNo: studentPayment.utr_no,
                transactionId: studentPayment.utr_no,
                date: studentPayment.created_at
              }
            }
          }
        } catch (apiError) {
          console.warn('API fetch failed, trying Supabase:', apiError)
        }
      }

      // Try Supabase as fallback
      if (isSupabaseConfigured && supabase) {
        if (studentRecord) {
          return {
            status: studentRecord.payment_approved === 'approved' ? 'completed' : 'pending',
            payment_approved: studentRecord.payment_approved || 'pending',
            payment_completion: Boolean(studentRecord.payment_completion),
            amount: configuredPaymentAmount
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch payment status from database:', error)
    }
    return null
  }

  const findLatestStudentPayment = async (profileData) => {
    const studentId = profileData?.studentId || ''
    const studentEmail = profileData?.email || localStorage.getItem('loginEmail') || ''

    // First, try to get status from database (cross-device sync)
    const dbPaymentStatus = await fetchPaymentStatusFromDatabase(studentId)

    try {
      const savedPayments = localStorage.getItem('paymentSubmissions')
      const allPayments = savedPayments ? JSON.parse(savedPayments) : []

      const studentPayments = Array.isArray(allPayments)
        ? allPayments.filter((payment) => {
            const paymentStudentCode = payment.studentCode || payment.studentId || ''
            const paymentEmail = payment.email || ''
            return paymentStudentCode === studentId || (studentEmail && paymentEmail === studentEmail)
          })
        : []

      if (!studentPayments.length && !dbPaymentStatus) {
        setLatestPayment(null)
        return
      }

      const latest = studentPayments.length > 0 ? [...studentPayments].sort((a, b) => {
        const timeA = new Date(a.date || 0).getTime()
        const timeB = new Date(b.date || 0).getTime()
        return timeB - timeA
      })[0] : null

      // Merge database status with localStorage data (database takes priority)
      const normalizedAmount = Number(latest?.amount || dbPaymentStatus?.amount)
      const nextAmount = normalizedAmount > 0 ? normalizedAmount : configuredPaymentAmount
      
      const finalPaymentData = {
        ...(latest || {}),
        ...(dbPaymentStatus || {}),
        amount: nextAmount,
        // Database status takes priority for approval/status
        status: dbPaymentStatus?.status || latest?.status || 'pending',
        payment_approved: dbPaymentStatus?.payment_approved || latest?.payment_approved || latest?.paymentApproved || 'pending',
        paymentApproved: dbPaymentStatus?.payment_approved || latest?.paymentApproved || latest?.payment_approved || 'pending',
        payment_completion: typeof dbPaymentStatus?.payment_completion === 'boolean'
          ? dbPaymentStatus.payment_completion
          : Boolean(latest?.payment_completion)
      }

      setLatestPayment(finalPaymentData)

      // Update localStorage with database status for offline use
      if (dbPaymentStatus && latest && studentPayments.length > 0) {
        const updatedPayments = allPayments.map(payment => {
          const paymentStudentCode = payment.studentCode || payment.studentId || ''
          if (paymentStudentCode === studentId) {
            return {
              ...payment,
              status: dbPaymentStatus.status,
              payment_approved: dbPaymentStatus.payment_approved,
              paymentApproved: dbPaymentStatus.payment_approved,
              payment_completion: Boolean(dbPaymentStatus.payment_completion)
            }
          }
          return payment
        })
        localStorage.setItem('paymentSubmissions', JSON.stringify(updatedPayments))
      }
    } catch {
      // If localStorage fails but we have DB status, use that
      if (dbPaymentStatus) {
        setLatestPayment({
          ...dbPaymentStatus,
          amount: dbPaymentStatus.amount || configuredPaymentAmount,
          paymentApproved: dbPaymentStatus.payment_approved
        })
      } else {
        setLatestPayment(null)
      }
    }
  }

  useEffect(() => {
    document.body.classList.add('system-cursor')
    
    // Load payment config from database first (cross-device sync)
    const loadConfig = async () => {
      try {
        const config = await loadPaymentConfigWithApi()
        setPaymentConfig(config)
      } catch (error) {
        console.warn('Failed to load payment config from API, using localStorage:', error)
        setPaymentConfig(loadPaymentConfig())
      }
    }
    loadConfig()
    
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    const profileCompleted = localStorage.getItem('profileCompleted')
    
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    
    if (profileCompleted !== 'true') {
      navigate('/profile-setup')
      return
    }
    
    // Load student profile from localStorage
    const savedProfile = localStorage.getItem('studentProfile')
    if (savedProfile) {
      try {
        const profileData = JSON.parse(savedProfile)
        setStudent({
          ...defaultStudentData,
          name: profileData.name || defaultStudentData.name,
          studentId: profileData.studentId || defaultStudentData.studentId,
          email: profileData.email || defaultStudentData.email,
          department: profileData.department || defaultStudentData.department,
          year: profileData.year || defaultStudentData.year,
          phone: profileData.phone || defaultStudentData.phone
        })
        findLatestStudentPayment(profileData)
      } catch (error) {
        console.error('Error loading profile:', error)
      }
    }

    return () => {
      document.body.classList.remove('system-cursor')
    }
  }, [navigate])

  const isPaymentApproved = 
    latestPayment?.status === 'completed' || 
    latestPayment?.status === 'approved' ||
    latestPayment?.payment_approved === 'approved' ||
    latestPayment?.paymentApproved === 'approved'
  
  const isPaymentDeclined = 
    latestPayment?.status === 'declined' ||
    latestPayment?.payment_approved === 'declined' ||
    latestPayment?.paymentApproved === 'declined'

  const isPaymentCompleted =
    latestPayment?.payment_completion === true ||
    latestPayment?.payment_completion === 1 ||
    latestPayment?.payment_completion === '1'
  const payment = latestPayment
    ? {
        transactionId: latestPayment.transactionId || latestPayment.utrNo || 'N/A',
        amount: `₹${Number(latestPayment.amount || configuredPaymentAmount)}`,
        paymentDate: latestPayment.date || new Date().toISOString(),
        paymentMethod: latestPayment.paymentMethod || 'UPI',
        status: isPaymentApproved ? 'Approved' : latestPayment.status === 'declined' ? 'Declined' : 'Under Review',
        description: 'Refresko 2026 - SKF Student Registration'
      }
    : null

  const gatePassPayload = useMemo(() => JSON.stringify({
    Student_Code: student.studentId || '',
    Name: student.name || '',
    Phone: student.phone || '',
    Email: student.email || '',
    Department: student.department || '',
    Year: student.year || ''
  }), [student])

  useEffect(() => {
    let isActive = true

    const generateGatePassQrCode = async () => {
      if (!isPaymentApproved) {
        setGatePassQrCodeUrl('')
        return
      }

      try {
        const dataUrl = await QRCode.toDataURL(gatePassPayload, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'H'
        })

        if (isActive) {
          setGatePassQrCodeUrl(dataUrl)
        }
      } catch (error) {
        console.error('Failed to generate gate pass QR code:', error)
        if (isActive) {
          setGatePassQrCodeUrl('')
        }
      }
    }

    generateGatePassQrCode()

    return () => {
      isActive = false
    }
  }, [gatePassPayload, isPaymentApproved])

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('profileCompleted')
    localStorage.removeItem('studentProfile')
    localStorage.removeItem('loginEmail')
    
    // Redirect to home
    navigate('/')
  }

  const handleMakePayment = () => {
    if (isPaymentCompleted) {
      return
    }

    if (isFoodIncluded) {
      setShowFoodModal(true)
      return
    }

    localStorage.setItem('foodPreference', 'null')
    navigate('/payment-gateway')
  }

  const handleProceedToPayment = () => {
    if (isPaymentCompleted) {
      return
    }

    if (foodPreference) {
      // Save food preference to localStorage
      localStorage.setItem('foodPreference', foodPreference)
      setShowFoodModal(false)
      // Navigate to payment gateway
      navigate('/payment-gateway')
    }
  }

  const handleFoodSelect = (preference) => {
    setFoodPreference(preference)
  }

  const generatePassCode = () => `SKF-PASS-${student.studentId}-REFRESKO2026`

  const containerVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      x: -20,
      transition: { duration: 0.3 }
    }
  }

  return (
    <div className="dashboard-page">
      <div className="hex-grid-overlay" />
      
      <Link to="/" className="back-home">
        <span>← Back to Home</span>
      </Link>

      <div className="dashboard-layout">
        {/* Sidebar Navigation */}
        <motion.aside 
          className="dashboard-sidebar"
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="sidebar-header">
            <div className="sidebar-logo">SKF</div>
            <span className="sidebar-title">DASHBOARD</span>
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeSection === 'home' ? 'active' : ''}`}
              onClick={() => setActiveSection('home')}
            >
              <span className="nav-icon">🏠</span>
              <span className="nav-label">Home</span>
            </button>
            <button 
              className={`nav-item ${activeSection === 'gatepass' ? 'active' : ''}`}
              onClick={() => setActiveSection('gatepass')}
            >
              <span className="nav-icon">🎫</span>
              <span className="nav-label">Gate Pass</span>
            </button>
            <button 
              className={`nav-item ${activeSection === 'receipt' ? 'active' : ''}`}
              onClick={() => setActiveSection('receipt')}
            >
              <span className="nav-icon">🧾</span>
              <span className="nav-label">Receipt</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <span className="nav-icon">🚪</span>
              <span className="nav-label">Logout</span>
            </button>
          </div>
        </motion.aside>

        {/* Main Content Area */}
        <main className="dashboard-main">
          <AnimatePresence mode="wait">
            {/* HOME SECTION */}
            {activeSection === 'home' && (
              <motion.div
                key="home"
                className="dashboard-section home-section"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="section-header">
                  <h1 className="section-title">Welcome Back!</h1>
                  <p className="section-subtitle">Manage your Refresko 2026 experience</p>
                </div>

                {/* Student Details Card */}
                <div className="student-card">
                  <div className="card-header">
                    <h2>Student Profile</h2>
                    <span className="status-badge active">Active</span>
                  </div>
                  <div className="student-info">
                    <div className="student-avatar">
                      <div className="avatar-placeholder">
                        <div className="avatar-glow"></div>
                        <span className="avatar-text">{student.name.split(' ').map(n => n[0]).join('')}</span>
                      </div>
                    </div>
                    <div className="student-details">
                      <div className="detail-row">
                        <div className="detail-icon">👤</div>
                        <div className="detail-content">
                          <span className="detail-label">Name</span>
                          <span className="detail-value">{student.name}</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-icon">🎫</div>
                        <div className="detail-content">
                          <span className="detail-label">Student ID</span>
                          <span className="detail-value">{student.studentId}</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-icon">📧</div>
                        <div className="detail-content">
                          <span className="detail-label">Email</span>
                          <span className="detail-value">{student.email}</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-icon">🎓</div>
                        <div className="detail-content">
                          <span className="detail-label">Department</span>
                          <span className="detail-value">{student.department}</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-icon">📅</div>
                        <div className="detail-content">
                          <span className="detail-label">Year</span>
                          <span className="detail-value">{student.year}</span>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-icon">📱</div>
                        <div className="detail-content">
                          <span className="detail-label">Phone</span>
                          <span className="detail-value">{student.phone}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Cards */}
                <div className="action-cards">
                  {/* Contribute to Fest Card */}
                  <motion.div 
                    className="action-card contribute-card"
                    whileHover={{ scale: 1.02, y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="action-icon">💳</div>
                    <h3>Contribute to Fest</h3>
                    <p>
                      Complete your registration by making the fest payment.
                      {isFoodIncluded ? ' Select your food preference and proceed to payment.' : ' Food is not included for this amount and payment opens directly.'}
                    </p>
                    <div className="payment-highlight">
                      <div className="payment-amount">
                        <span className="amount-label">Registration Fee</span>
                        <span className="amount-value">₹{configuredPaymentAmount}</span>
                      </div>
                      <div className="payment-includes">
                        <span>✓ All Event Access</span>
                        <span>{isFoodIncluded ? '✓ Food & Refreshments' : '✕ Food Not Included'}</span>
                        <span>✓ Merchandise Voucher</span>
                      </div>
                    </div>
                    <button
                      className="action-btn"
                      onClick={handleMakePayment}
                      disabled={isPaymentCompleted}
                    >
                      <span>{isPaymentCompleted ? 'Payment Completed' : 'Make Payment'}</span>
                    </button>
                  </motion.div>

                  {/* Register for Events Card */}
                  {/* <motion.div 
                    className="action-card events-card"
                    whileHover={{ scale: 1.02, y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="action-icon">🎪</div>
                    <h3>Register for Events</h3>
                    <p>Explore and register for exciting events at Refresko 2026!</p>
                    
                    {student.registeredEvents.length > 0 && (
                      <div className="registered-events">
                        <span className="events-label">Your Registered Events:</span>
                        <div className="events-tags">
                          {student.registeredEvents.map((event, index) => (
                            <span key={index} className="event-tag">{event}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <button className="action-btn secondary">
                      <span>Browse All Events</span>
                    </button>
                  </motion.div> */}
                </div>

              </motion.div>
            )}

            {/* GATE PASS SECTION */}
            {activeSection === 'gatepass' && (
              <motion.div
                key="gatepass"
                className="dashboard-section gatepass-section"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="section-header">
                  <h1 className="section-title">Gate Pass</h1>
                  <p className="section-subtitle">Your digital entry pass for Refresko 2026</p>
                </div>

                {isPaymentApproved ? (
                <div className="gatepass-card">
                  <div className="gatepass-header">
                    <div className="gatepass-logo">
                      <div className="logo-icons-row">
                        <img src="/college.png" alt="College Logo" className="brand-logo-img" />
                        <span className="logo-separator">|</span>
                        <img src="/refresko.png" alt="Refresko Logo" className="brand-logo-img" />
                      </div>
                      <div className="logo-title-row">
                        <span className="logo-text">REFRESKO</span>
                        <span className="logo-year">2026</span>
                      </div>
                    </div>
                    <span className="pass-type">SKF STUDENT PASS</span>
                  </div>

                  <div className="qr-container">
                    <div className="qr-code">
                      <div className="qr-placeholder">
                        {gatePassQrCodeUrl ? (
                          <img
                            src={gatePassQrCodeUrl}
                            alt="Gate pass QR code"
                            className="qr-image"
                          />
                        ) : (
                          <span className="qr-loading-text">Generating QR...</span>
                        )}
                      </div>
                      <div className="qr-glow"></div>
                    </div>
                    <p className="qr-instruction">Scan at entry gate for verification</p>
                  </div>

                  <div className="pass-details">
                    <div className="pass-detail-row">
                      <span className="pass-label">Pass Holder</span>
                      <span className="pass-value">{student.name}</span>
                    </div>
                    <div className="pass-detail-row">
                      <span className="pass-label">Student ID</span>
                      <span className="pass-value">{student.studentId}</span>
                    </div>
                    <div className="pass-detail-row">
                      <span className="pass-label">Pass Code</span>
                      <span className="pass-value code">{generatePassCode()}</span>
                    </div>
                    <div className="pass-detail-row">
                      <span className="pass-label">Valid For</span>
                      <span className="pass-value">All Days - March 27th & 28th, 2026</span>
                    </div>
                  </div>

                  <div className="pass-footer">
                    <span className="pass-status valid">✓ VALID PASS</span>
                  </div>
                </div>
                ) : (
                <div className="student-card">
                  <div className="card-header">
                    <h2>Gate Pass Not Available Yet</h2>
                    <span className="status-badge">Pending</span>
                  </div>
                  <p className="section-subtitle" style={{ marginBottom: '0' }}>
                    {isPaymentDeclined
                      ? 'Your payment was declined by admin. Please submit payment proof again.'
                      : 'Your payment is under admin review. Gate pass will appear here after approval.'}
                  </p>
                </div>
                )}

                <div className="pass-instructions">
                  <h3>Entry Instructions</h3>
                  <ul>
                    <li>Present this QR code at the main entrance</li>
                    <li>Keep your Student ID ready for verification</li>
                    <li>This pass grants access to all SKF student areas</li>
                    
                  </ul>
                </div>
              </motion.div>
            )}

            {/* RECEIPT SECTION */}
            {activeSection === 'receipt' && (
              <motion.div
                key="receipt"
                className="dashboard-section receipt-section"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="section-header">
                  <h1 className="section-title">Payment Receipt</h1>
                  <p className="section-subtitle">Your payment confirmation and details</p>
                </div>

                {isPaymentApproved && payment ? (
                <div className="receipt-card">
                  <div className="receipt-header">
                    <div className="receipt-logo">
                      <div className="logo-icons-row">
                        <img src="/college.png" alt="College Logo" className="brand-logo-img" />
                        <span className="logo-separator">|</span>
                        <img src="/refresko.png" alt="Refresko Logo" className="brand-logo-img" />
                      </div>
                      <div className="logo-title-row">
                        <span className="logo-text">REFRESKO</span>
                        <span className="logo-year">2026</span>
                      </div>
                    </div>
                    <div className="receipt-badge">
                      <span className={`payment-status ${isPaymentApproved ? 'paid' : 'pending'}`}>
                        ✓ {payment.status}
                      </span>
                    </div>
                  </div>

                  <div className="receipt-body">
                    <div className="receipt-title">
                      <h2>Payment Receipt</h2>
                      <span className="receipt-number">#{payment.transactionId}</span>
                    </div>

                    <div className="receipt-info">
                      <div className="info-group">
                        <span className="info-label">Paid By</span>
                        <span className="info-value">{student.name}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Student ID</span>
                        <span className="info-value">{student.studentId}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Email</span>
                        <span className="info-value">{student.email}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Payment Date</span>
                        <span className="info-value">{new Date(payment.paymentDate).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}</span>
                      </div>
                      <div className="info-group">
                        <span className="info-label">Payment Method</span>
                        <span className="info-value">{payment.paymentMethod}</span>
                      </div>
                    </div>

                    <div className="receipt-breakdown">
                      <div className="breakdown-total">
                        <span>Total Amount</span>
                        <span className="total-amount">{payment.amount}</span>
                      </div>
                    </div>

                    <div className="receipt-description">
                      <span className="desc-label">Description</span>
                      <span className="desc-value">{payment.description}</span>
                    </div>
                  </div>

                  <div className="receipt-footer">
                    <div className="receipt-stamp">
                      <div className="stamp-inner">
                        <span>PAID</span>
                      </div>
                    </div>
                    {/* <div className="receipt-actions">
                      <button className="receipt-btn">
                        <span>📥 Download Receipt</span>
                      </button>
                      <button className="receipt-btn secondary">
                        <span>📧 Email Receipt</span>
                      </button>
                    </div> */}
                  </div>

                  <div className="receipt-note">
                    <p>This is a computer-generated receipt and does not require a signature.</p>
                    <p>For any queries, contact: Ankit Rajak(CSE 3rd Year):7439498461</p>
                  </div>
                </div>
                ) : (
                <div className="student-card">
                  <div className="card-header">
                    <h2>Receipt Not Available Yet</h2>
                    <span className="status-badge">Pending</span>
                  </div>
                  <p className="section-subtitle" style={{ marginBottom: '0' }}>
                    {isPaymentDeclined
                      ? 'Your payment was declined by admin. Please complete payment again to generate receipt.'
                      : 'Your payment receipt will be generated here once admin approves your payment.'}
                  </p>
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Food Preference Modal */}
      <AnimatePresence>
        {showFoodModal && (
          <>
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFoodModal(false)}
            />
            <motion.div
              className="food-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="modal-header">
                <h2>Select Food Preference</h2>
                <button className="modal-close" onClick={() => setShowFoodModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <p className="modal-description">
                  Choose your preferred meal type for Refresko 2026
                </p>
                <div className="food-options">
                  <label 
                    className={`food-option ${foodPreference === 'VEG' ? 'selected' : ''}`}
                    onClick={() => handleFoodSelect('VEG')}
                  >
                    <div className="food-icon">🥗</div>
                    <div className="food-details">
                      <span className="food-type">Vegetarian</span>
                      <span className="food-desc">Pure veg meals</span>
                    </div>
                    <div className="food-radio">
                      <input
                        type="radio"
                        name="foodPreference"
                        value="VEG"
                        checked={foodPreference === 'VEG'}
                        onChange={() => handleFoodSelect('VEG')}
                      />
                    </div>
                  </label>
                  <label 
                    className={`food-option ${foodPreference === 'NON-VEG' ? 'selected' : ''}`}
                    onClick={() => handleFoodSelect('NON-VEG')}
                  >
                    <div className="food-icon">🍗</div>
                    <div className="food-details">
                      <span className="food-type">Non-Vegetarian</span>
                      <span className="food-desc">Includes meat options</span>
                    </div>
                    <div className="food-radio">
                      <input
                        type="radio"
                        name="foodPreference"
                        value="NON-VEG"
                        checked={foodPreference === 'NON-VEG'}
                        onChange={() => handleFoodSelect('NON-VEG')}
                      />
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-btn cancel" 
                  onClick={() => setShowFoodModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn proceed"
                  onClick={handleProceedToPayment}
                  disabled={!foodPreference}
                >
                  Proceed to Payment
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SKFDashboard
