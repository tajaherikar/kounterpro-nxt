/**
 * lib/lazy-date-utils.ts
 * 
 * Lazy-loaded date utilities to avoid importing date-fns on initial page load
 * Only loads when explicitly imported/called
 */

export async function formatDateLazy(date: string | Date, format: string = 'short'): Promise<string> {
  // Dynamically import date-fns only when needed
  const { format: datefnsFormat } = await import('date-fns')
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (format === 'short') {
    return datefnsFormat(d, 'MMM dd, yyyy')
  } else if (format === 'time') {
    return datefnsFormat(d, 'HH:mm')
  } else if (format === 'full') {
    return datefnsFormat(d, 'MMMM dd, yyyy HH:mm:ss')
  }
  
  return datefnsFormat(d, format)
}

export async function formatRelativeTimeLazy(date: string | Date): Promise<string> {
  const { formatDistanceToNow } = await import('date-fns')
  
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export async function getDateRangeLazy(startDate: Date, endDate: Date): Promise<string> {
  const { format: datefnsFormat } = await import('date-fns')
  
  const start = datefnsFormat(startDate, 'MMM dd')
  const end = datefnsFormat(endDate, 'MMM dd, yyyy')
  
  return `${start} - ${end}`
}
