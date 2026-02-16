import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import {
  getActivePaymentOption,
  getUpiPayload,
  loadPaymentConfig,
  savePaymentConfig
} from '../../lib/paymentConfig'
import './PaymentAmountManagement.css'

const PaymentAmountManagement = () => {
  const [config, setConfig] = useState(() => loadPaymentConfig())
  const [draftOptions, setDraftOptions] = useState(() => loadPaymentConfig().options)
  const [activeOptionId, setActiveOptionId] = useState(() => loadPaymentConfig().activeOptionId)
  const [previewQrCodeUrl, setPreviewQrCodeUrl] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    setDraftOptions(config.options)
    setActiveOptionId(config.activeOptionId)
  }, [config])

  useEffect(() => {
    const refreshConfig = () => {
      setConfig(loadPaymentConfig())
    }

    const handleStorageUpdate = (event) => {
      if (event.key === 'paymentGatewayConfig') {
        refreshConfig()
      }
    }

    window.addEventListener('storage', handleStorageUpdate)
    window.addEventListener('paymentConfigUpdated', refreshConfig)

    return () => {
      window.removeEventListener('storage', handleStorageUpdate)
      window.removeEventListener('paymentConfigUpdated', refreshConfig)
    }
  }, [])

  const activeOption = useMemo(() => getActivePaymentOption({
    activeOptionId,
    options: draftOptions
  }), [activeOptionId, draftOptions])

  useEffect(() => {
    let isMounted = true

    const generatePreviewQr = async () => {
      if (!activeOption) {
        setPreviewQrCodeUrl('')
        return
      }

      try {
        const qrDataUrl = await QRCode.toDataURL(getUpiPayload(activeOption), {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'H'
        })

        if (isMounted) {
          setPreviewQrCodeUrl(qrDataUrl)
        }
      } catch {
        if (isMounted) {
          setPreviewQrCodeUrl('')
        }
      }
    }

    generatePreviewQr()

    return () => {
      isMounted = false
    }
  }, [activeOption])

  const handleOptionChange = (optionId, field, value) => {
    setDraftOptions((previous) => previous.map((option) => {
      if (option.id !== optionId) {
        return option
      }

      if (field === 'amount') {
        const numericAmount = Math.max(0, Number(value) || 0)
        return {
          ...option,
          amount: numericAmount,
          note: `Refresko Registration ₹${numericAmount || 0}`,
          includeFood: numericAmount === 600 ? true : option.includeFood
        }
      }

      if (field === 'includeFood') {
        return {
          ...option,
          includeFood: Boolean(value)
        }
      }

      return {
        ...option,
        [field]: value
      }
    }))
  }

  const handleSaveSettings = () => {
    const saved = savePaymentConfig({
      activeOptionId,
      options: draftOptions
    })

    setConfig(saved)
    setSaveMessage('Payment settings saved. Student dashboard now uses this amount and QR.')
    window.setTimeout(() => setSaveMessage(''), 3000)
  }

  return (
    <div className="payment-amount-management">
      <div className="section-header">
        <div className="header-content">
          <h2>Payment Amount Management</h2>
          <p>Control which amount and QR code students see in the payment gateway</p>
        </div>
      </div>

      <div className="payment-config-grid">
        <div className="amount-config-card">
          <h3>QR Options</h3>
          <p className="config-note">Select the active QR option and update amount/UPI if needed.</p>

          <div className="amount-options-list">
            {draftOptions.map((option) => (
              <motion.div
                key={option.id}
                className={`amount-option-item ${activeOptionId === option.id ? 'active' : ''}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <label className="option-select-row">
                  <input
                    type="radio"
                    name="activePaymentOption"
                    checked={activeOptionId === option.id}
                    onChange={() => setActiveOptionId(option.id)}
                  />
                  <span>Use this QR for students</span>
                </label>

                <div className="option-inputs">
                  <label>
                    Amount (₹)
                    <input
                      type="number"
                      min="1"
                      step="50"
                      value={option.amount}
                      onChange={(event) => handleOptionChange(option.id, 'amount', event.target.value)}
                    />
                  </label>
                  <label>
                    UPI ID
                    <input
                      type="text"
                      value={option.upiId}
                      onChange={(event) => handleOptionChange(option.id, 'upiId', event.target.value)}
                      placeholder="example@upi"
                    />
                  </label>
                </div>

                <div className="food-toggle-row">
                  <span className="food-toggle-label">Include food</span>
                  <label className="food-toggle-control">
                    <input
                      type="checkbox"
                      checked={Boolean(option.includeFood)}
                      disabled={Number(option.amount) === 600}
                      onChange={(event) => handleOptionChange(option.id, 'includeFood', event.target.checked)}
                    />
                    <span>
                      {Number(option.amount) === 600
                        ? 'On (required for ₹600)'
                        : option.includeFood
                          ? 'On'
                          : 'Off'}
                    </span>
                  </label>
                </div>
              </motion.div>
            ))}
          </div>

          <button className="save-config-btn interactive" onClick={handleSaveSettings}>
            Save Payment Settings
          </button>

          {saveMessage && <p className="save-message">{saveMessage}</p>}
        </div>

        <div className="active-preview-card">
          <h3>Live Payment Preview</h3>
          <p className="config-note">Students will see this amount and QR in “Make Payment”.</p>

          <div className="active-preview-amount">₹{activeOption?.amount || 0}</div>
          <div className="active-preview-upi">{activeOption?.upiId || 'N/A'}</div>
          <div className="active-preview-food">
            Food: {activeOption?.includeFood ? 'Included' : 'Not Included'}
          </div>

          <div className="preview-qr-box">
            {previewQrCodeUrl ? (
              <img src={previewQrCodeUrl} alt="Selected payment QR" className="preview-qr-image" />
            ) : (
              <div className="preview-qr-empty">QR preview unavailable</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentAmountManagement
