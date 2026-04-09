import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { API_URL } from '../config/api'

const ReportDownload = ({ endpoint, label = 'Download Report' }) => {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async (format, period) => {
    setDownloading(true)
    setOpen(false)
    try {
      const params = new URLSearchParams({ format, ...(period && { period }) })
      const res = await fetch(`${API_URL}/reports/${endpoint}?${params}`)
      if (!res.ok) throw new Error('Download failed')

      const blob = await res.blob()
      const ext = format === 'pdf' ? 'pdf' : 'xlsx'
      const filename = `${endpoint}_report_${period || 'all'}.${ext}`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
    }
    setDownloading(false)
  }

  const periods = [
    { key: 'daily', label: 'Today' },
    { key: 'weekly', label: 'Last 7 Days' },
    { key: null, label: 'All Time' }
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={downloading}
        className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-gray-700 text-white rounded-lg hover:bg-dark-600 transition-colors text-sm disabled:opacity-50"
      >
        <Download size={16} />
        {downloading ? 'Downloading...' : label}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-dark-700 border border-gray-700 rounded-lg shadow-xl w-56 overflow-hidden">
            {periods.map((p) => (
              <div key={p.key || 'all'}>
                <div className="px-3 py-2 text-xs text-gray-500 font-semibold uppercase bg-dark-800">
                  {p.label}
                </div>
                <button
                  onClick={() => handleDownload('excel', p.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 hover:text-white transition-colors"
                >
                  <FileSpreadsheet size={14} className="text-green-400" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleDownload('pdf', p.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-600 hover:text-white transition-colors"
                >
                  <FileText size={14} className="text-red-400" />
                  PDF (.pdf)
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ReportDownload
