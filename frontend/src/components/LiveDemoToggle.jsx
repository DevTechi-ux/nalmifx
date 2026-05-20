// Two-state toggle for filtering admin views by Live vs Demo accounts.
// Drop it into a page header and pass the current value + setter; the
// caller is responsible for threading `value` into its API queries as
// `accountKind`.
const LiveDemoToggle = ({ value, onChange, className = '' }) => {
  return (
    <div className={`flex gap-1 p-1 bg-dark-700 rounded-lg w-fit ${className}`}>
      {[
        { key: 'live', label: 'Live' },
        { key: 'demo', label: 'Demo' }
      ].map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            value === t.key
              ? (t.key === 'live' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white')
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export default LiveDemoToggle
