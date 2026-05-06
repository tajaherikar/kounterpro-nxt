'use client'
/**
 * app/backup/page.tsx
 *
 * Backup & Restore Management Page
 * Features:
 *   - Export all data as JSON backup
 *   - Restore from JSON backup file
 *   - Backup history and logs
 *   - Storage information
 *   - Scheduled backup status
 */
import React, { useState, useMemo, useEffect } from 'react'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatINR } from '@/lib/currency'

interface BackupData {
  invoices: any[]
  expenses: any[]
  inventory: any[]
  customers: any[]
  quotations: any[]
  timestamp: string
  version: string
}

interface BackupLog {
  id: string
  type: 'export' | 'import'
  timestamp: string
  status: 'success' | 'failed'
  size?: number
  message: string
}

export default function BackupPage() {
  return <BackupContent />
}

function BackupContent() {
  const { user } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([])
  const [restoreProgress, setRestoreProgress] = useState(0)

  // Load backup logs from localStorage
  useEffect(() => {
    const logs = localStorage.getItem(`backup_logs_${user?.id}`)
    if (logs) {
      try {
        setBackupLogs(JSON.parse(logs))
      } catch (e) {
        console.error('Error parsing backup logs:', e)
      }
    }
  }, [user?.id])

  // Handle Export
  const handleExport = async () => {
    if (!user) {
      toast.error('User not authenticated')
      return
    }

    setExporting(true)
    try {
      // Fetch all data
      const [invoicesRes, expensesRes, inventoryRes, quotationsRes] = await Promise.all([
        supabase.from('invoices').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('quotations').select('*'),
      ])

      const backupData: BackupData = {
        invoices: invoicesRes.data || [],
        expenses: expensesRes.data || [],
        inventory: inventoryRes.data || [],
        customers: [], // Will be extracted from invoices
        quotations: quotationsRes.data || [],
        timestamp: new Date().toISOString(),
        version: '1.0',
      }

      // Extract unique customers from invoices
      const customerSet = new Set<string>()
      backupData.invoices.forEach((inv: any) => {
        if (inv.customer_name) {
          customerSet.add(JSON.stringify({ name: inv.customer_name, email: inv.customer_email, phone: inv.customer_mobile }))
        }
      })
      backupData.customers = Array.from(customerSet).map((c) => JSON.parse(c))

      // Create blob and download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kounterpro-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Log the export
      const newLog: BackupLog = {
        id: Date.now().toString(),
        type: 'export',
        timestamp: new Date().toISOString(),
        status: 'success',
        size: blob.size,
        message: `Exported ${backupData.invoices.length} invoices, ${backupData.expenses.length} expenses`,
      }
      const updatedLogs = [newLog, ...backupLogs]
      setBackupLogs(updatedLogs)
      localStorage.setItem(`backup_logs_${user.id}`, JSON.stringify(updatedLogs))

      toast.success('Backup exported successfully!')
    } catch (error) {
      console.error('Export error:', error)
      const newLog: BackupLog = {
        id: Date.now().toString(),
        type: 'export',
        timestamp: new Date().toISOString(),
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      const updatedLogs = [newLog, ...backupLogs]
      setBackupLogs(updatedLogs)
      localStorage.setItem(`backup_logs_${user.id}`, JSON.stringify(updatedLogs))

      toast.error('Failed to export backup')
    } finally {
      setExporting(false)
    }
  }

  // Handle Import
  const handleImport = async (file: File) => {
    if (!user) {
      toast.error('User not authenticated')
      return
    }

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a valid JSON backup file')
      return
    }

    setImporting(true)
    setRestoreProgress(0)

    try {
      const text = await file.text()
      const backupData = JSON.parse(text) as BackupData

      setRestoreProgress(20)

      // Restore invoices
      if (backupData.invoices?.length > 0) {
        const { error } = await supabase.from('invoices').upsert(backupData.invoices)
        if (error) throw error
      }
      setRestoreProgress(40)

      // Restore expenses
      if (backupData.expenses?.length > 0) {
        const { error } = await supabase.from('expenses').upsert(backupData.expenses)
        if (error) throw error
      }
      setRestoreProgress(60)

      // Restore inventory
      if (backupData.inventory?.length > 0) {
        const { error } = await supabase.from('inventory').upsert(backupData.inventory)
        if (error) throw error
      }
      setRestoreProgress(80)

      // Restore quotations
      if (backupData.quotations?.length > 0) {
        const { error } = await supabase.from('quotations').upsert(backupData.quotations)
        if (error) throw error
      }
      setRestoreProgress(100)

      // Log the import
      const newLog: BackupLog = {
        id: Date.now().toString(),
        type: 'import',
        timestamp: new Date().toISOString(),
        status: 'success',
        message: `Restored ${backupData.invoices?.length || 0} invoices, ${backupData.expenses?.length || 0} expenses`,
      }
      const updatedLogs = [newLog, ...backupLogs]
      setBackupLogs(updatedLogs)
      localStorage.setItem(`backup_logs_${user.id}`, JSON.stringify(updatedLogs))

      toast.success('Backup restored successfully!')
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Import error:', error)
      const newLog: BackupLog = {
        id: Date.now().toString(),
        type: 'import',
        timestamp: new Date().toISOString(),
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      const updatedLogs = [newLog, ...backupLogs]
      setBackupLogs(updatedLogs)
      localStorage.setItem(`backup_logs_${user.id}`, JSON.stringify(updatedLogs))

      toast.error('Failed to restore backup')
    } finally {
      setImporting(false)
      setRestoreProgress(0)
    }
  }

  return (
    <div className="page-content">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Export Backup Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary-blue, #2845D6)' }}>
              download
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Export Backup</h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary, #666)', margin: '0 0 16px 0', flex: 1 }}>
            Download all your data (invoices, expenses, inventory) as a JSON file for safekeeping.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--primary-blue, #2845D6)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              opacity: exporting ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {exporting ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                Exporting...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: 18 }}>
                  cloud_download
                </span>
                Export Now
              </>
            )}
          </button>
        </div>

        {/* Import Backup Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="material-icons" style={{ fontSize: '32px', color: '#4caf50' }}>
              upload
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Restore Backup</h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary, #666)', margin: '0 0 16px 0', flex: 1 }}>
            Upload a previously exported JSON backup file to restore your data.
          </p>
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleImport(e.target.files[0])
              }
              e.target.value = ''
            }}
            disabled={importing}
            style={{ display: 'none' }}
            id="backup-file-input"
          />
          <button
            onClick={() => document.getElementById('backup-file-input')?.click()}
            disabled={importing}
            style={{
              padding: '10px 16px',
              backgroundColor: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              opacity: importing ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {importing ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                Restoring ({restoreProgress}%)...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: 18 }}>
                  cloud_upload
                </span>
                Select File
              </>
            )}
          </button>
        </div>

        {/* Info Card */}
        <div className="card card-info" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="material-icons" style={{ fontSize: '32px', color: 'var(--primary-blue, #2845D6)' }}>
              info
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Backup Info</h3>
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary, #333)' }}>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Automatic Backups:</strong> Your data is securely stored in Supabase cloud.
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Manual Backups:</strong> Download JSON files regularly for local storage.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Storage Limit:</strong> No limit for backups. Keep as many as you need.
            </p>
          </div>
        </div>
      </div>

      {/* Restore Progress */}
      {restoreProgress > 0 && restoreProgress < 100 && (
        <div className="card card-info" style={{ padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span className="material-icons" style={{ fontSize: '20px', color: 'var(--primary-blue, #2845D6)' }}>
              sync
            </span>
            <span style={{ fontWeight: '600', color: 'var(--primary-blue, #2845D6)' }}>Restoring backup...</span>
          </div>
          <div className="progress-track" style={{ width: '100%', height: '4px', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                backgroundColor: 'var(--primary-blue, #2845D6)',
                width: `${restoreProgress}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary, #666)' }}>
            {restoreProgress}% complete
          </div>
        </div>
      )}

      {/* Backup History */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Backup History</h3>

        {backupLogs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted, #999)' }}>
            <span className="material-icons" style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>
              history
            </span>
            <p>No backup history yet. Create your first backup above.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color, #e0e4f8)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '13px' }}>
                    Type
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '13px' }}>
                    Date & Time
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '13px' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '13px' }}>
                    Details
                  </th>
                  {/* Size column for export backups */}
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '13px' }}>
                    Size
                  </th>
                </tr>
              </thead>
              <tbody>
                {backupLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-icons" style={{ fontSize: '18px', color: log.type === 'export' ? 'var(--primary-blue, #2845D6)' : '#4caf50' }}>
                          {log.type === 'export' ? 'download' : 'upload'}
                        </span>
                        <span style={{ fontWeight: '600' }}>
                          {log.type === 'export' ? 'Export' : 'Import'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary, #666)' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: log.status === 'success' ? '#d4edda' : '#f8d7da',
                          color: log.status === 'success' ? '#155724' : '#721c24',
                          fontWeight: '600',
                          fontSize: '11px',
                        }}
                      >
                        {log.status === 'success' ? '✓ Success' : '✗ Failed'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary, #666)' }}>
                      {log.message}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: 'var(--text-secondary, #666)' }}>
                      {log.size ? `${(log.size / 1024).toFixed(2)} KB` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Best Practices */}
      <div className="card" style={{ padding: '24px', marginTop: '24px', backgroundColor: '#f9fafb' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Best Practices</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: 'var(--text-secondary, #666)' }}>
          <li>Export backups regularly (weekly or monthly)</li>
          <li>Store backup files in a secure location (cloud storage, external drive)</li>
          <li>Keep at least 2-3 versions of your backups</li>
          <li>Test restore functionality periodically</li>
          <li>Include backup file date in the filename</li>
          <li>Never share backup files as they contain sensitive business data</li>
        </ul>
      </div>
    </div>
  )
}
