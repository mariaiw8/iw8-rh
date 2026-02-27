'use client'

import { useState, useMemo, useCallback } from 'react'

interface UsePaginationOptions {
  pageSize?: number
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize = 20 } = options
  const [currentPage, setCurrentPage] = useState(1)

  const totalItems = items.length
  const totalPages = Math.ceil(totalItems / pageSize)

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage, pageSize])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages || 1)))
  }, [totalPages])

  const resetPage = useCallback(() => {
    setCurrentPage(1)
  }, [])

  return {
    currentPage,
    totalItems,
    totalPages,
    pageSize,
    paginatedItems,
    goToPage,
    resetPage,
  }
}
