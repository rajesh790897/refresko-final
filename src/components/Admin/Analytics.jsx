import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cpanelApi } from '../../lib/cpanelApi'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import './Analytics.css'

const Analytics = () => {
  const [students, setStudents] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedView, setSelectedView] = useState('overview')
  
  // Filters
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterYear, setFilterYear] = useState('all')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Fetch data from database
  const fetchData = async () => {
    setLoading(true)
    setError('')

    try {
      let studentsData = []
      let paymentsData = []

      // Try Supabase first
      if (isSupabaseConfigured && supabase) {
        try {
          // Fetch ALL students (remove default 1000 limit)
          const { data: studentsFromDB, error: studentsError, count: studentsCount } = await supabase
            .from('students')
            .select('*', { count: 'exact' })

          // If we got less than expected, fetch in batches
          let allStudents = studentsFromDB || []
          if (studentsCount && studentsCount > 1000 && allStudents.length < studentsCount) {
            const batchSize = 1000
            for (let i = 1000; i < studentsCount; i += batchSize) {
              const { data: batchData } = await supabase
                .from('students')
                .select('*')
                .range(i, i + batchSize - 1)
              if (batchData) {
                allStudents = [...allStudents, ...batchData]
              }
            }
          }

          const { data: paymentsFromDB, error: paymentsError } = await supabase
            .from('payments')
            .select('*')

          if (!studentsError && allStudents) {
            // Map Supabase column names to expected format
            studentsData = allStudents.map(s => ({
              student_code: s.student_code || s.code,
              student_name: s.student_name || s.name || s.full_name || 'Unknown',
              department: s.department || 'Not specified',
              year: s.year || s.academic_year || 'Not specified',
              email: s.email || '',
              phone: s.phone || s.mobile || ''
            }))
          }
          if (!paymentsError && paymentsFromDB) {
            paymentsData = paymentsFromDB
          }
        } catch (supabaseError) {
          console.error('Supabase error:', supabaseError)
        }
      }

      // Fallback to cPanel API if Supabase fails or not configured
      if (studentsData.length === 0 && cpanelApi.isConfigured()) {
        try {
          const paymentsResponse = await cpanelApi.listPayments()
          if (paymentsResponse.success && Array.isArray(paymentsResponse.payments)) {
            paymentsData = paymentsResponse.payments
            
            // Extract unique students from payments
            const studentMap = new Map()
            paymentsData.forEach(payment => {
              if (payment.student_code) {
                studentMap.set(payment.student_code, {
                  student_code: payment.student_code,
                  student_name: payment.student_name || 'Unknown',
                  department: payment.department || 'Not specified',
                  year: payment.year || 'Not specified',
                  email: payment.email || '',
                  phone: payment.phone || ''
                })
              }
            })
            studentsData = Array.from(studentMap.values())
          }
        } catch (apiError) {
          console.warn('cPanel API failed:', apiError)
        }
      }

      setStudents(studentsData)
      setPayments(paymentsData)
      console.log('Fetched students:', studentsData.length, 'Sample:', studentsData[0])
      console.log('Fetched payments:', paymentsData.length)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Auto-refresh every 1 minute for real-time data
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  // Get unique departments and years
  const departments = ['all', ...new Set(students.map(s => s.department).filter(Boolean))]
  const years = ['all', ...new Set(students.map(s => s.year).filter(Boolean))]

  // Filter students based on selected filters
  const filteredStudents = students.filter(student => {
    const matchesDept = filterDepartment === 'all' || student.department === filterDepartment
    const matchesYear = filterYear === 'all' || student.year === filterYear
    const matchesSearch = searchQuery === '' || 
      student.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_code?.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesDept && matchesYear && matchesSearch
  })

  // Categorize students by payment status
  const paidStudentCodes = new Set(
    payments
      .filter(p => p.payment_approved === 'approved' || p.status === 'completed')
      .map(p => p.student_code)
  )

  const paidStudents = filteredStudents.filter(s => paidStudentCodes.has(s.student_code))
  const unpaidStudents = filteredStudents.filter(s => !paidStudentCodes.has(s.student_code))

  // Filter by payment status
  let displayStudents = filteredStudents
  if (filterPaymentStatus === 'paid') {
    displayStudents = paidStudents
  } else if (filterPaymentStatus === 'unpaid') {
    displayStudents = unpaidStudents
  }

  // Pagination logic
  const totalPages = Math.ceil(displayStudents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedStudents = displayStudents.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterDepartment, filterYear, filterPaymentStatus, searchQuery])

  // Calculate analytics by department
  const departmentAnalytics = departments
    .filter(d => d !== 'all')
    .map(dept => {
      const deptStudents = students.filter(s => s.department === dept)
      const deptPaid = deptStudents.filter(s => paidStudentCodes.has(s.student_code))
      const deptUnpaid = deptStudents.filter(s => !paidStudentCodes.has(s.student_code))
      
      return {
        department: dept,
        total: deptStudents.length,
        paid: deptPaid.length,
        unpaid: deptUnpaid.length,
        revenue: deptPaid.length * 600 // Assuming ₹600 per student
      }
    })
    .sort((a, b) => b.total - a.total)

  // Calculate analytics by year
  const yearAnalytics = years
    .filter(y => y !== 'all')
    .map(year => {
      const yearStudents = students.filter(s => s.year === year)
      const yearPaid = yearStudents.filter(s => paidStudentCodes.has(s.student_code))
      const yearUnpaid = yearStudents.filter(s => !paidStudentCodes.has(s.student_code))
      
      return {
        year,
        total: yearStudents.length,
        paid: yearPaid.length,
        unpaid: yearUnpaid.length,
        revenue: yearPaid.length * 600
      }
    })
    .sort((a, b) => b.total - a.total)

  // Calculate overall stats (based on filtered students)
  const totalStudents = filteredStudents.length
  const totalPaid = paidStudents.length
  const totalUnpaid = unpaidStudents.length
  const totalRevenue = totalPaid * 600
  const paymentRate = totalStudents > 0 ? ((totalPaid / totalStudents) * 100).toFixed(1) : 0

  // Export Functions
  const exportToCSV = () => {
    // Prepare CSV data
    const headers = ['#', 'Student Code', 'Name', 'Department', 'Year', 'Payment Status']
    const rows = displayStudents.map((student, index) => {
      const isPaid = paidStudentCodes.has(student.student_code)
      return [
        index + 1,
        student.student_code,
        student.student_name,
        student.department,
        student.year,
        isPaid ? 'Paid' : 'Unpaid'
      ]
    })

    // Create CSV content
    let csvContent = headers.join(',') + '\n'
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n'
    })

    // Add summary at the end
    csvContent += '\n'
    csvContent += 'Summary\n'
    csvContent += `Total Students,${totalStudents}\n`
    csvContent += `Paid Students,${totalPaid}\n`
    csvContent += `Unpaid Students,${totalUnpaid}\n`
    csvContent += `Total Revenue,₹${totalRevenue}\n`
    csvContent += `Payment Rate,${paymentRate}%\n`

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `analytics_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToPDF = () => {
    const doc = new jsPDF()

    // Add title
    doc.setFontSize(20)
    doc.text('Analytics Report', 14, 20)

    // Add date
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28)

    // Add summary statistics
    doc.setFontSize(12)
    doc.text('Summary Statistics', 14, 38)
    doc.setFontSize(10)
    doc.text(`Total Students: ${totalStudents}`, 14, 46)
    doc.text(`Paid Students: ${totalPaid} (${paymentRate}%)`, 14, 52)
    doc.text(`Unpaid Students: ${totalUnpaid}`, 14, 58)
    doc.text(`Total Revenue: ₹${totalRevenue}`, 14, 64)

    // Add filter info if any filters are applied
    if (filterDepartment !== 'all' || filterYear !== 'all' || filterPaymentStatus !== 'all') {
      doc.setFontSize(10)
      doc.text('Applied Filters:', 14, 74)
      let yPos = 80
      if (filterDepartment !== 'all') {
        doc.text(`Department: ${filterDepartment}`, 14, yPos)
        yPos += 6
      }
      if (filterYear !== 'all') {
        doc.text(`Year: ${filterYear}`, 14, yPos)
        yPos += 6
      }
      if (filterPaymentStatus !== 'all') {
        doc.text(`Payment Status: ${filterPaymentStatus}`, 14, yPos)
        yPos += 6
      }
    }

    // Add student table
    const tableData = displayStudents.map((student, index) => {
      const isPaid = paidStudentCodes.has(student.student_code)
      return [
        index + 1,
        student.student_code,
        student.student_name,
        student.department,
        student.year,
        isPaid ? 'Paid' : 'Unpaid'
      ]
    })

    doc.autoTable({
      startY: filterDepartment !== 'all' || filterYear !== 'all' || filterPaymentStatus !== 'all' ? 90 : 75,
      head: [['#', 'Student Code', 'Name', 'Department', 'Year', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 0, 51],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { cellWidth: 50 },
        3: { cellWidth: 35 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 }
      }
    })

    // Save the PDF
    doc.save(`analytics_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="analytics-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>{error}</p>
        <button onClick={fetchData} className="retry-btn">Retry</button>
      </div>
    )
  }

  return (
    <div className="analytics">
      {/* Header with Refresh */}
      <div className="analytics-header">
        <div>
          <h1>Analytics Dashboard</h1>
          <p className="last-updated">
            Real-time data • Auto-refresh every 1 minute
          </p>
        </div>
        <button onClick={fetchData} className="refresh-btn interactive" disabled={loading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Overview Stats */}
      <div className="analytics-overview">
        <motion.div
          className="overview-card total"
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
            <h3>Total Students</h3>
            <p className="overview-value">{totalStudents}</p>
            <span className="overview-label">Registered</span>
          </div>
        </motion.div>

        <motion.div
          className="overview-card paid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="overview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="overview-content">
            <h3>Paid Students</h3>
            <p className="overview-value">{totalPaid}</p>
            <span className="overview-label">{paymentRate}% Payment Rate</span>
          </div>
        </motion.div>

        <motion.div
          className="overview-card unpaid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="overview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="overview-content">
            <h3>Unpaid Students</h3>
            <p className="overview-value">{totalUnpaid}</p>
            <span className="overview-label">{(100 - paymentRate).toFixed(1)}% Pending</span>
          </div>
        </motion.div>

        <motion.div
          className="overview-card revenue"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="overview-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="overview-content">
            <h3>Total Revenue</h3>
            <p className="overview-value">₹{totalRevenue.toLocaleString()}</p>
            <span className="overview-label">From {totalPaid} payments</span>
          </div>
        </motion.div>
      </div>

      {/* Filters Section */}
      <motion.div
        className="filters-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="filters-header">
          <h3>Filters</h3>
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setFilterDepartment('all')
              setFilterYear('all')
              setFilterPaymentStatus('all')
              setSearchQuery('')
            }}
          >
            Clear All
          </button>
        </div>

        <div className="filters-grid">
          <div className="filter-group">
            <label>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Department
            </label>
            <select 
              value={filterDepartment} 
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Departments</option>
              {departments.filter(d => d !== 'all').map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Year
            </label>
            <select 
              value={filterYear} 
              onChange={(e) => setFilterYear(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Years</option>
              {years.filter(y => y !== 'all').map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Payment Status
            </label>
            <select 
              value={filterPaymentStatus} 
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid Only</option>
              <option value="unpaid">Unpaid Only</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Search Student
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name or Student Code..."
              className="filter-input"
            />
          </div>
        </div>

        <div className="filter-results">
          Showing <strong>{displayStudents.length}</strong>{' '}
          {(filterDepartment !== 'all' || filterYear !== 'all' || filterPaymentStatus !== 'all' || searchQuery) ? (
            <>
              of <strong>{filteredStudents.length}</strong> filtered
            </>
          ) : ''}{' '}
          students
        </div>
      </motion.div>

      {/* View Selector */}
      <motion.div
        className="view-selector"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <button
          className={`view-btn ${selectedView === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedView('overview')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Overview
        </button>
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
          className={`view-btn ${selectedView === 'students' ? 'active' : ''}`}
          onClick={() => setSelectedView('students')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Student List
        </button>
      </motion.div>

      {/* Content Views */}
      <AnimatePresence mode="wait">
        {/* Overview View */}
        {selectedView === 'overview' && (
          <motion.div
            key="overview"
            className="view-content"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="overview-grid">
              <div className="overview-panel">
                <h3>Payment Summary</h3>
                <div className="summary-stats">
                  <div className="summary-item">
                    <span className="summary-label">Total Collected</span>
                    <span className="summary-value success">₹{totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Expected from Unpaid</span>
                    <span className="summary-value pending">₹{(totalUnpaid * 600).toLocaleString()}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Potential Total</span>
                    <span className="summary-value">₹{(totalStudents * 600).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="overview-panel">
                <h3>Top Departments</h3>
                <div className="top-list">
                  {departmentAnalytics.slice(0, 5).map((dept, index) => (
                    <div key={dept.department} className="top-item">
                      <span className="top-rank">#{index + 1}</span>
                      <span className="top-label">{dept.department}</span>
                      <span className="top-value">{dept.paid}/{dept.total}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overview-panel">
                <h3>Year Distribution</h3>
                <div className="top-list">
                  {yearAnalytics.map((year, index) => (
                    <div key={year.year} className="top-item">
                      <span className="top-rank">{year.year}</span>
                      <span className="top-label">Paid: {year.paid}</span>
                      <span className="top-value">Total: {year.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Department View */}
        {selectedView === 'department' && (
          <motion.div
            key="department"
            className="view-content"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="chart-header">
              <h2>Department-wise Analysis</h2>
              <p>Payment distribution across departments</p>
            </div>

            <div className="analytics-table">
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Total Students</th>
                    <th>Paid</th>
                    <th>Unpaid</th>
                    <th>Payment Rate</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentAnalytics.map((dept, index) => (
                    <motion.tr
                      key={dept.department}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <td className="dept-name">{dept.department}</td>
                      <td className="text-center">{dept.total}</td>
                      <td className="text-center success">{dept.paid}</td>
                      <td className="text-center danger">{dept.unpaid}</td>
                      <td className="text-center">
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill"
                            style={{ width: `${(dept.paid / dept.total * 100)}%` }}
                          />
                          <span className="progress-text">
                            {dept.total > 0 ? ((dept.paid / dept.total * 100).toFixed(1)) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right">₹{dept.revenue.toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td><strong>Total</strong></td>
                    <td className="text-center"><strong>{totalStudents}</strong></td>
                    <td className="text-center success"><strong>{totalPaid}</strong></td>
                    <td className="text-center danger"><strong>{totalUnpaid}</strong></td>
                    <td className="text-center"><strong>{paymentRate}%</strong></td>
                    <td className="text-right"><strong>₹{totalRevenue.toLocaleString()}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        )}

        {/* Year View */}
        {selectedView === 'year' && (
          <motion.div
            key="year"
            className="view-content"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="chart-header">
              <h2>Year-wise Analysis</h2>
              <p>Payment distribution across academic years</p>
            </div>

            <div className="analytics-table">
              <table>
                <thead>
                  <tr>
                    <th>Academic Year</th>
                    <th>Total Students</th>
                    <th>Paid</th>
                    <th>Unpaid</th>
                    <th>Payment Rate</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {yearAnalytics.map((year, index) => (
                    <motion.tr
                      key={year.year}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <td className="dept-name">{year.year}</td>
                      <td className="text-center">{year.total}</td>
                      <td className="text-center success">{year.paid}</td>
                      <td className="text-center danger">{year.unpaid}</td>
                      <td className="text-center">
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill"
                            style={{ width: `${(year.paid / year.total * 100)}%` }}
                          />
                          <span className="progress-text">
                            {year.total > 0 ? ((year.paid / year.total * 100).toFixed(1)) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right">₹{year.revenue.toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Students List View */}
        {selectedView === 'students' && (
          <motion.div
            key="students"
            className="view-content"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="analytics-table-container">
              <div className="table-header">
                <h2>Detailed Student List</h2>
              </div>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Code</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Year</th>
                    <th>Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.length > 0 ? (
                    paginatedStudents.map((student, index) => {
                      const isPaid = paidStudentCodes.has(student.student_code)
                      const actualIndex = startIndex + index + 1
                      return (
                        <motion.tr
                          key={student.student_code}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: Math.min(index * 0.02, 1) }}
                          className={isPaid ? 'paid-row' : 'unpaid-row'}
                        >
                          <td className="text-center">{actualIndex}</td>
                          <td className="student-code">{student.student_code}</td>
                          <td className="student-name">{student.student_name}</td>
                          <td>{student.department}</td>
                          <td className="text-center">{student.year}</td>
                          <td className="text-center">
                            {isPaid ? (
                              <span className="status-badge paid">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Paid
                              </span>
                            ) : (
                              <span className="status-badge unpaid">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="15" y1="9" x2="9" y2="15"/>
                                  <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                                Unpaid
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="no-data">
                        No students found matching the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {displayStudents.length > 0 && (
                <div className="table-footer">
                  <div className="pagination-info">
                    <span>Page {currentPage} of {totalPages} • Showing {paginatedStudents.length} of {displayStudents.length}</span>
                  </div>
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn" 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <button 
                      className="pagination-btn" 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Section */}
      <motion.div
        className="export-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <h3>Export Analytics</h3>
        <p>Download detailed reports in your preferred format</p>
        <div className="export-buttons">
          <button className="export-btn interactive" onClick={exportToPDF}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download as PDF
          </button>
          <button className="export-btn interactive" onClick={exportToCSV}>
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
