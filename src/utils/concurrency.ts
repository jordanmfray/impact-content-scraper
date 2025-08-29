/**
 * Utility for running async operations with controlled concurrency
 */
export async function processConcurrently<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number, current?: T) => void
    onError?: (error: Error, item: T) => void
  } = {}
): Promise<R[]> {
  const { concurrency = 3, onProgress, onError } = options
  const results: R[] = []
  const total = items.length
  let completed = 0

  // Process items in chunks of specified concurrency
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    
    // Process chunk in parallel
    const chunkPromises = chunk.map(async (item) => {
      try {
        onProgress?.(completed, total, item)
        const result = await processor(item)
        completed++
        onProgress?.(completed, total)
        return result
      } catch (error) {
        completed++
        onError?.(error as Error, item)
        onProgress?.(completed, total)
        throw error // Re-throw to be caught in Promise.allSettled
      }
    })

    // Wait for all items in this chunk to complete
    const chunkResults = await Promise.allSettled(chunkPromises)
    
    // Extract successful results
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        console.error(`Failed to process item at index ${i + index}:`, result.reason)
      }
    })
  }

  return results
}

/**
 * Rate-limited concurrent processing with delay between batches
 */
export async function processWithRateLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    concurrency?: number
    batchDelay?: number // ms delay between batches
    onProgress?: (completed: number, total: number, current?: T) => void
  } = {}
): Promise<{ results: R[], errors: Array<{ item: T, error: Error }> }> {
  const { concurrency = 3, batchDelay = 1000, onProgress } = options
  const results: R[] = []
  const errors: Array<{ item: T, error: Error }> = []
  const total = items.length
  let completed = 0

  // Process in chunks with delays
  for (let i = 0; i < items.length; i += concurrency) {
    if (i > 0 && batchDelay > 0) {
      console.log(`⏳ Waiting ${batchDelay}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, batchDelay))
    }

    const chunk = items.slice(i, i + concurrency)
    console.log(`🔄 Processing batch ${Math.floor(i / concurrency) + 1}: ${chunk.length} items`)
    
    const chunkPromises = chunk.map(async (item, index) => {
      try {
        onProgress?.(completed, total, item)
        const result = await processor(item)
        completed++
        onProgress?.(completed, total)
        return { success: true, result, item }
      } catch (error) {
        completed++
        onProgress?.(completed, total)
        return { success: false, error: error as Error, item }
      }
    })

    const chunkResults = await Promise.allSettled(chunkPromises)
    
    chunkResults.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        const { success, result, error, item } = promiseResult.value
        if (success) {
          results.push(result)
        } else {
          errors.push({ item, error })
        }
      } else {
        // This shouldn't happen since we're catching errors above
        const item = chunk[index]
        errors.push({ item, error: new Error(`Promise rejected: ${promiseResult.reason}`) })
      }
    })
  }

  return { results, errors }
}
