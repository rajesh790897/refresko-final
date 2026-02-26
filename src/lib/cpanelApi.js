const API_BASE_URL = (import.meta.env.VITE_CPANEL_API_BASE_URL || '').replace(/\/$/, '')
const SUPERADMIN_TOKEN = import.meta.env.VITE_CPANEL_SUPERADMIN_TOKEN || ''

const parseJsonSafe = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const buildUrl = (path, query) => {
  const trimmedPath = path.startsWith('/') ? path : `/${path}`
  const base = API_BASE_URL || ''

  const queryString = query && Object.keys(query).length > 0
    ? `?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')).toString()}`
    : ''

  return `${base}${trimmedPath}${queryString}`
}

const request = async (path, { method = 'GET', headers = {}, body, query } = {}) => {
  if (!API_BASE_URL) {
    const error = new Error('CPANEL_API_BASE_URL_MISSING')
    error.code = 'CPANEL_API_BASE_URL_MISSING'
    throw error
  }

  // For FormData, don't set Content-Type header - let browser set it with boundary
  const fetchOptions = {
    method,
    body
  }

  // Only include headers if not FormData
  if (!(body instanceof FormData)) {
    fetchOptions.headers = headers
  }

  // Add timeout to prevent hanging requests (10 seconds)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  fetchOptions.signal = controller.signal

  try {
    const response = await fetch(buildUrl(path, query), fetchOptions)
    clearTimeout(timeoutId)

    const payload = await parseJsonSafe(response)

    if (!response.ok || payload?.success === false) {
      const message = payload?.message || `Request failed with status ${response.status}`
      const error = new Error(message)
      error.status = response.status
      error.payload = payload
      throw error
    }

    return payload
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      const timeoutError = new Error('Backend API request timed out')
      timeoutError.code = 'TIMEOUT'
      throw timeoutError
    }
    throw err
  }
}

export const cpanelApi = {
  isConfigured: () => Boolean(API_BASE_URL),
  baseUrl: API_BASE_URL,

  getActiveConfig: async () => {
    const payload = await request('/config/active')
    const options = Array.isArray(payload?.options) ? payload.options : []

    const mappedOptions = options.map((option) => {
      const amountNumber = Number(option.amount)
      const roundedAmount = Number.isFinite(amountNumber) && amountNumber > 0 ? Math.round(amountNumber) : 600
      const includeFoodFromApi = option.include_food === 1 || option.include_food === '1' || option.include_food === true
      return {
        id: String(option.option_id || `amount-${roundedAmount}`),
        amount: roundedAmount,
        upiId: String(option.upi_id || ''),
        payeeName: String(option.payee_name || 'Refresko 2026'),
        note: String(option.note_text || `Refresko Registration ₹${roundedAmount}`),
        includeFood: roundedAmount === 600 ? true : includeFoodFromApi
      }
    })

    const active = payload?.active || null
    const activeOptionId = active?.option_id
      ? String(active.option_id)
      : (mappedOptions[0]?.id || 'amount-600')

    return {
      activeOptionId,
      options: mappedOptions
    }
  },

  setPaymentConfig: async (config) => {
    const options = Array.isArray(config?.options) ? config.options : []
    const payload = {
      option_id: config?.activeOptionId || '',
      options: options.map((option) => ({
        id: option.id,
        amount: Number(option.amount) || 0,
        upiId: option.upiId || '',
        payeeName: option.payeeName || 'Refresko 2026',
        note: option.note || '',
        includeFood: Number(option.amount) === 600 ? true : Boolean(option.includeFood)
      }))
    }

    return request('/config/active', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  },

  listPayments: async ({ status, search, limit = 200, offset = 0 } = {}) => {
    return request('/payments/list', {
      query: { status, search, limit, offset }
    })
  },

  submitPayment: async (formData) => {
    return request('/payments/submit', {
      method: 'POST',
      body: formData
    })
  },

  updatePaymentDecision: async ({ paymentId, decision }) => {
    return request('/payments/decision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment_id: paymentId,
        decision
      })
    })
  },

  adminLogin: async ({ email, password }) => {
    return request('/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
  },

  listAdmins: async () => {
    return request('/admin/list')
  },

  createAdmin: async ({ name, email, password, role = 'admin' }) => {
    return request('/admin/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password, role })
    })
  },

  updateAdmin: async ({ adminId, status, password, name }) => {
    return request('/admin/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_id: adminId,
        status,
        password,
        name
      })
    })
  },

  deleteAdmin: async ({ adminId }) => {
    return request('/admin/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ admin_id: adminId })
    })
  },

  getStudent: async (studentCode) => {
    return request('/students/get', {
      query: { student_code: studentCode }
    })
  }
}
