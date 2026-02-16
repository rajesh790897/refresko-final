import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import './AdminLoginManagement.css'

const ADMIN_ACCOUNTS_KEY = 'adminAccounts'

const loadAdminAccounts = () => {
  try {
    const saved = localStorage.getItem(ADMIN_ACCOUNTS_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

const saveAdminAccounts = (accounts) => {
  localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts))
  window.dispatchEvent(new Event('adminAccountsUpdated'))
}

const AdminLoginManagement = () => {
  const [adminAccounts, setAdminAccounts] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setAdminAccounts(loadAdminAccounts())
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleCreateAdmin = (event) => {
    event.preventDefault()

    const name = formData.name.trim()
    const email = formData.email.trim().toLowerCase()
    const password = formData.password.trim()

    if (!name || !email || !password) {
      setError('All fields are required')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    const exists = adminAccounts.some((account) => account.email === email)
    if (exists) {
      setError('Admin email already exists. Use a different email.')
      return
    }

    const newAccount = {
      id: `ADM${Date.now()}`,
      name,
      email,
      password,
      status: 'active',
      createdAt: new Date().toISOString()
    }

    const updatedAccounts = [newAccount, ...adminAccounts]
    setAdminAccounts(updatedAccounts)
    saveAdminAccounts(updatedAccounts)
    setFormData({ name: '', email: '', password: '' })
    setSuccess('Admin login created successfully')
  }

  const handleToggleStatus = (adminId) => {
    const updatedAccounts = adminAccounts.map((account) =>
      account.id === adminId
        ? { ...account, status: account.status === 'active' ? 'inactive' : 'active' }
        : account
    )

    setAdminAccounts(updatedAccounts)
    saveAdminAccounts(updatedAccounts)
  }

  const handleResetPassword = (adminId) => {
    const newPassword = window.prompt('Enter new password (minimum 8 characters)')

    if (!newPassword) return

    if (newPassword.trim().length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    const updatedAccounts = adminAccounts.map((account) =>
      account.id === adminId
        ? { ...account, password: newPassword.trim() }
        : account
    )

    setAdminAccounts(updatedAccounts)
    saveAdminAccounts(updatedAccounts)
    setSuccess('Password updated successfully')
  }

  const handleDeleteAdmin = (adminId) => {
    const confirmed = window.confirm('Delete this admin login? This action cannot be undone.')
    if (!confirmed) return

    const updatedAccounts = adminAccounts.filter((account) => account.id !== adminId)
    setAdminAccounts(updatedAccounts)
    saveAdminAccounts(updatedAccounts)
  }

  return (
    <div className="admin-login-management">
      <div className="section-header">
        <div className="header-content">
          <h2>Admin Login Control</h2>
          <p>Create and manage admin login credentials</p>
        </div>
      </div>

      <motion.form
        className="admin-create-form"
        onSubmit={handleCreateAdmin}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="adminName">Admin Name</label>
            <input
              id="adminName"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter admin name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="adminEmail">Admin Email</label>
            <input
              id="adminEmail"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@skf.in"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="adminPassword">Password</label>
            <input
              id="adminPassword"
              name="password"
              type="text"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              required
            />
          </div>
        </div>

        {error && <p className="form-message error">{error}</p>}
        {success && <p className="form-message success">{success}</p>}

        <button type="submit" className="create-admin-btn">Create Admin Login</button>
      </motion.form>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Admin ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {adminAccounts.map((account) => (
              <tr key={account.id}>
                <td className="admin-id">{account.id}</td>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>
                  <span className={`status-badge ${account.status}`}>{account.status}</span>
                </td>
                <td>{new Date(account.createdAt).toLocaleString()}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="action-btn toggle"
                      onClick={() => handleToggleStatus(account.id)}
                      type="button"
                    >
                      {account.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="action-btn reset"
                      onClick={() => handleResetPassword(account.id)}
                      type="button"
                    >
                      Reset Password
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteAdmin(account.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {adminAccounts.length === 0 && (
          <div className="empty-state">
            <p>No admin accounts created yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminLoginManagement
