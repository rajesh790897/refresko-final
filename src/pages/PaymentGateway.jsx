import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getActivePaymentOption, getUpiPayload, loadPaymentConfig } from '../lib/paymentConfig'
import { cpanelApi } from '../lib/cpanelApi'
import './PaymentGateway.css'

const PaymentGateway = () => {
  const navigate = useNavigate()
  const [foodPreference, setFoodPreference] = useState('')
  const [studentProfile, setStudentProfile] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('pending') // pending, processing, success
  const [transactionId, setTransactionId] = useState('')
  const [utrNumber, setUtrNumber] = useState('')
  const [paymentScreenshot, setPaymentScreenshot] = useState(null)
  const [paymentScreenshotName, setPaymentScreenshotName] = useState('')
  const [paymentScreenshotBase64, setPaymentScreenshotBase64] = useState(null)
  const [formError, setFormError] = useState('')
  const [paymentConfig, setPaymentConfig] = useState(() => loadPaymentConfig())
  const [paymentQrCodeUrl, setPaymentQrCodeUrl] = useState('')

  const activePaymentOption = useMemo(
    () => getActivePaymentOption(paymentConfig),
    [paymentConfig]
  )
  const isFoodIncluded = Boolean(activePaymentOption?.includeFood)

  useEffect(() => {
    document.body.classList.add('system-cursor')
    const configFromStorage = loadPaymentConfig()
    setPaymentConfig(configFromStorage)
    const currentOption = getActivePaymentOption(configFromStorage)
    const requiresFoodPreference = Boolean(currentOption?.includeFood)

    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    const profileCompleted = localStorage.getItem('profileCompleted')
    
    if (!isAuthenticated || profileCompleted !== 'true') {
      navigate('/login')
      return
    }

    // Get food preference
    const savedFoodPreference = localStorage.getItem('foodPreference')
    const normalizedSavedFood = savedFoodPreference && savedFoodPreference !== 'null' ? savedFoodPreference : ''
    if (requiresFoodPreference && !normalizedSavedFood) {
      navigate('/dashboard')
      return
    }
    setFoodPreference(requiresFoodPreference ? normalizedSavedFood : 'NOT_INCLUDED')

    // Get student profile
    const savedProfile = localStorage.getItem('studentProfile')
    if (savedProfile) {
      setStudentProfile(JSON.parse(savedProfile))
    }

    const refreshPaymentConfig = () => {
      setPaymentConfig(loadPaymentConfig())
    }

    const handleStorageUpdate = (event) => {
      if (event.key === 'paymentGatewayConfig') {
        refreshPaymentConfig()
      }
    }

    window.addEventListener('storage', handleStorageUpdate)
    window.addEventListener('paymentConfigUpdated', refreshPaymentConfig)

    return () => {
      document.body.classList.remove('system-cursor')
      window.removeEventListener('storage', handleStorageUpdate)
      window.removeEventListener('paymentConfigUpdated', refreshPaymentConfig)
    }
  }, [navigate])

  useEffect(() => {
    let isMounted = true

    const generatePaymentQrCode = async () => {
      if (!activePaymentOption) {
        setPaymentQrCodeUrl('')
        return
      }

      try {
        const qrDataUrl = await QRCode.toDataURL(getUpiPayload(activePaymentOption), {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'H'
        })

        if (isMounted) {
          setPaymentQrCodeUrl(qrDataUrl)
        }
      } catch {
        if (isMounted) {
          setPaymentQrCodeUrl('')
        }
      }
    }

    generatePaymentQrCode()

    return () => {
      isMounted = false
    }
  }, [activePaymentOption])

  const handleScreenshotUpload = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      setPaymentScreenshot(null)
      setPaymentScreenshotBase64(null)
      setPaymentScreenshotName('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setFormError('Please upload a valid image file for payment screenshot')
      setPaymentScreenshot(null)
      setPaymentScreenshotBase64(null)
      setPaymentScreenshotName('')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setPaymentScreenshotBase64(reader.result)
      setPaymentScreenshotName(file.name)
      setFormError('')
    }
    reader.readAsDataURL(file)
    setPaymentScreenshot(file)
  }

  const handleConfirmPayment = async () => {
    const normalizedUtr = utrNumber.trim().toUpperCase()
    const currentStudentId = studentProfile?.studentId || ''
    const savedFoodPreference = localStorage.getItem('foodPreference')
    const normalizedSavedFood = savedFoodPreference && savedFoodPreference !== 'null' ? savedFoodPreference : ''
    const effectiveFoodPreference = isFoodIncluded ? (foodPreference || normalizedSavedFood || '') : null
    const payableAmount = Number(activePaymentOption?.amount) || 600

    if (!paymentScreenshot) {
      setFormError('Please upload payment screenshot before submitting')
      return
    }

    if (!normalizedUtr) {
      setFormError('Please enter UTR number')
      return
    }

    if (isFoodIncluded && !effectiveFoodPreference) {
      setFormError('Food preference is missing. Please go back and select food preference again.')
      return
    }

    if (!activePaymentOption) {
      setFormError('Payment configuration is unavailable. Please contact admin.')
      return
    }

    if (!/^[A-Z0-9]{8,30}$/.test(normalizedUtr)) {
      setFormError('UTR must be 8-30 characters and contain only letters and numbers')
      return
    }

    let usedUtrRegistry = {}
    try {
      const savedRegistry = localStorage.getItem('usedUtrRegistry')
      usedUtrRegistry = savedRegistry ? JSON.parse(savedRegistry) : {}
    } catch {
      usedUtrRegistry = {}
    }

    const existingOwner = usedUtrRegistry[normalizedUtr]
    if (existingOwner && existingOwner !== currentStudentId) {
      setFormError('This UTR number is already used by another user. Please check and enter a unique UTR.')
      return
    }

    usedUtrRegistry[normalizedUtr] = currentStudentId
    localStorage.setItem('usedUtrRegistry', JSON.stringify(usedUtrRegistry))
    setFormError('')
    setPaymentStatus('processing')

    const txnId = `TXN${Date.now()}`
    const paymentId = `PAY${Date.now()}`

    if (cpanelApi.isConfigured()) {
      try {
        const formData = new FormData()
        formData.append('payment_id', paymentId)
        formData.append('transaction_id', txnId)
        formData.append('utr_no', normalizedUtr)
        formData.append('student_code', currentStudentId)
        formData.append('student_name', studentProfile.name || 'N/A')
        formData.append('email', studentProfile.email || '')
        formData.append('department', studentProfile.department || '')
        formData.append('year', studentProfile.year || '')
        formData.append('amount', String(payableAmount))
        formData.append('payment_method', 'UPI')
        formData.append('food_included', isFoodIncluded ? '1' : '0')
        formData.append('food_preference', effectiveFoodPreference || '')

        if (paymentScreenshot && paymentScreenshot instanceof File) {
          formData.append('screenshot', paymentScreenshot, paymentScreenshotName || 'payment-screenshot.jpg')
        }

        await cpanelApi.submitPayment(formData)
      } catch (apiError) {
        console.warn('cPanel API payment submission failed, using localStorage fallback:', apiError)
      }
    }
    
    // Simulate payment processing
    setTimeout(async () => {
      setTransactionId(txnId)
      setPaymentStatus('success')
      
      // Update localStorage with payment info
      localStorage.setItem('paymentCompleted', 'true')
      localStorage.setItem('transactionId', txnId)
      localStorage.setItem('paymentUTR', normalizedUtr)
      localStorage.setItem('paymentFoodPreference', effectiveFoodPreference === null ? 'null' : effectiveFoodPreference)
      localStorage.setItem('paymentScreenshotName', paymentScreenshotName)

      const cachedProfileRaw = localStorage.getItem('studentProfile')
      if (cachedProfileRaw) {
        try {
          const cachedProfile = JSON.parse(cachedProfileRaw)
          const nextProfile = {
            ...cachedProfile,
            payment_completion: true,
            gate_pass_created: false,
            payment_approved: 'pending',
            food_included: isFoodIncluded,
            food_preference: effectiveFoodPreference
          }
          localStorage.setItem('studentProfile', JSON.stringify(nextProfile))
        } catch {
          // ignore malformed profile cache
        }
      }

      const submittedPayment = {
        id: paymentId,
        utrNo: normalizedUtr,
        studentCode: studentProfile.studentId || 'N/A',
        studentName: studentProfile.name || 'N/A',
        email: studentProfile.email || '',
        department: studentProfile.department || 'N/A',
        year: studentProfile.year || 'N/A',
        amount: payableAmount,
        date: new Date().toISOString(),
        status: 'pending',
        transactionId: txnId,
        screenshotName: paymentScreenshotName,
        hasScreenshot: Boolean(paymentScreenshot),
        foodPreference: effectiveFoodPreference,
        foodIncluded: isFoodIncluded
      }

      let existingSubmissions = []
      try {
        const savedSubmissions = localStorage.getItem('paymentSubmissions')
        existingSubmissions = savedSubmissions ? JSON.parse(savedSubmissions) : []
      } catch {
        existingSubmissions = []
      }

      const updatedSubmissions = [submittedPayment, ...existingSubmissions].slice(0, 200)
      localStorage.setItem('paymentSubmissions', JSON.stringify(updatedSubmissions))

      if (isSupabaseConfigured && supabase) {
        try {
          const studentCode = (studentProfile.studentId || '').trim().toUpperCase()
          if (studentCode) {
            await supabase
              .from('students')
              .update({
                payment_completion: true,
                gate_pass_created: false,
                payment_approved: 'pending',
                food_included: isFoodIncluded,
                food_preference: effectiveFoodPreference
              })
              .eq('student_code', studentCode)
          }
        } catch (error) {
          console.error('Unable to sync payment status to Supabase:', error)
        }
      }

      if (paymentScreenshot) {
        try {
          localStorage.setItem(`paymentScreenshot:${normalizedUtr}`, paymentScreenshotBase64 || '')
        } catch {
          console.warn('Payment screenshot skipped due to localStorage size limit')
        }
      }
      window.dispatchEvent(new Event('paymentSubmissionsUpdated'))
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard')
      }, 3000)
    }, 2000)
  }

  if (!studentProfile) {
    return null
  }

  return (
    <div className="payment-page">
      <div className="hex-grid-overlay" />

      <Link to="/dashboard" className="back-dashboard">
        <span>← Back to Dashboard</span>
      </Link>

      <div className="payment-container">
        {paymentStatus === 'pending' && (
          <motion.div
            className="payment-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="payment-header">
              <motion.div
                className="payment-icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                💳
              </motion.div>
              <h1 className="payment-title">PAYMENT GATEWAY</h1>
              <p className="payment-subtitle">Refresko 2026 Registration Payment</p>
            </div>

            <div className="payment-details-card">
              <h2>Order Summary</h2>
              <div className="order-details">
                <div className="detail-item">
                  <span className="item-label">Student Name</span>
                  <span className="item-value">{studentProfile.name}</span>
                </div>
                <div className="detail-item">
                  <span className="item-label">Student ID</span>
                  <span className="item-value">{studentProfile.studentId}</span>
                </div>
                <div className="detail-item">
                  <span className="item-label">Email</span>
                  <span className="item-value">{studentProfile.email}</span>
                </div>
                <div className="detail-item">
                  <span className="item-label">Food Preference</span>
                  <span className="item-value food-badge">
                    {isFoodIncluded
                      ? (foodPreference === 'VEG' ? '🥗 Vegetarian' : '🍗 Non-Vegetarian')
                      : '🍽️ Food Not Included'}
                  </span>
                </div>
              </div>

              <div className="payment-breakdown">
                <div className="breakdown-total">
                  <span>Total Amount</span>
                  <span className="total-amount">₹{activePaymentOption?.amount || 600}</span>
                </div>
              </div>
            </div>

            <div className="qr-payment-card">
              <h2>Scan QR Code to Pay</h2>
              <p className="qr-instructions">Use any UPI app to scan and pay</p>
              
              <div className="qr-code-container">
                <div className="qr-code-wrapper">
                  {paymentQrCodeUrl ? (
                    <img
                      src={paymentQrCodeUrl}
                      alt={`Payment QR for ₹${activePaymentOption?.amount || 600}`}
                      className="payment-qr"
                    />
                  ) : (
                    <div className="payment-qr payment-qr-unavailable">QR unavailable</div>
                  )}
                  <div className="qr-glow-effect"></div>
                </div>
                
                <div className="payment-info">
                  <p className="upi-id">UPI ID: <span>{activePaymentOption?.upiId || 'refresko@upi'}</span></p>
                  <p className="amount-display">Amount: <span>₹{activePaymentOption?.amount || 600}</span></p>
                </div>
              </div>

              <div className="payment-actions">
                <div className="payment-proof-section">
                  <h3>Upload Payment Proof</h3>

                  <div className="proof-field">
                    <label htmlFor="paymentScreenshot">Payment Screenshot</label>
                    <input
                      id="paymentScreenshot"
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotUpload}
                    />
                    {paymentScreenshotName && (
                      <p className="field-hint success">Selected: {paymentScreenshotName}</p>
                    )}
                  </div>

                  <div className="proof-field">
                    <label htmlFor="utrNumber">UTR Number</label>
                    <input
                      id="utrNumber"
                      type="text"
                      value={utrNumber}
                      onChange={(event) => {
                        setUtrNumber(event.target.value)
                        if (formError) setFormError('')
                      }}
                      placeholder="Enter unique UTR"
                      autoComplete="off"
                    />
                    <p className="field-hint">UTR must be unique for each user</p>
                  </div>

                  {formError && <p className="payment-error">{formError}</p>}

                  <button className="payment-confirm-btn" onClick={handleConfirmPayment}>
                    <span>Submit Payment Proof</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {paymentStatus === 'processing' && (
          <motion.div
            className="payment-processing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="processing-animation">
              <div className="spinner"></div>
            </div>
            <h2>Processing Payment...</h2>
            <p>Please wait while we verify your transaction</p>
          </motion.div>
        )}

        {paymentStatus === 'success' && (
          <motion.div
            className="payment-success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="success-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              ✓
            </motion.div>
            <h2>Payment Under Review</h2>
            <p className="success-message">
              Your payment has been sent to admin for approval
            </p>
            <div className="txn-details">
              <span>Transaction ID:</span>
              <span className="txn-id">{transactionId}</span>
            </div>
            <p className="redirect-message">
              Redirecting to dashboard...
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default PaymentGateway
