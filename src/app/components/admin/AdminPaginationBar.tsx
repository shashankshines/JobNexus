'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface AdminPaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  itemName?: string;
  loading?: boolean;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  variant?: 'standalone' | 'integrated';
  className?: string;
}

export function AdminPaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemName = 'records',
  loading = false,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  variant = 'standalone',
  className = '',
}: AdminPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 3) {
      return [1, 2, 3, 4, 'ellipsis-right', totalPages];
    }

    if (safeCurrentPage >= totalPages - 2) {
      return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis-left', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, 'ellipsis-right', totalPages];
  };

  const pages = getPageNumbers();

  const isIntegrated = variant === 'integrated';
  const containerClasses = [
    isIntegrated ? 'admin-table-footer' : 'admin-pagination-bar',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="navigation" aria-label={`Pagination for ${itemName}`}>
      {/* Left: Range Info & Page Size */}
      <div className="admin-pagination-left">
        <div className="admin-pagination-info">
          Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> {itemName}
          {totalPages > 1 && (
            <span className="admin-pagination-page-hint">
              (Page {safeCurrentPage} of {totalPages})
            </span>
          )}
        </div>

        {onPageSizeChange && (
          <div className="admin-pagination-size-wrap">
            <span className="admin-pagination-divider" aria-hidden="true" />
            <label className="admin-pagination-size-label">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
                aria-label={`Items per page for ${itemName}`}
                className="admin-pagination-select"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>per page</span>
            </label>
          </div>
        )}
      </div>

      {/* Right: Modern Navigation Buttons */}
      <div className="admin-pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1 || loading}
          className="admin-pagination-btn"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
          <span>Previous</span>
        </button>

        <div className="admin-pagination-pages">
          {pages.map((p, idx) => {
            if (p === 'ellipsis-left' || p === 'ellipsis-right') {
              return (
                <span key={`ellipsis-${idx}`} className="admin-page-ellipsis" aria-hidden="true">
                  …
                </span>
              );
            }

            const isActive = p === safeCurrentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                disabled={loading}
                className={`admin-page-number-btn ${isActive ? 'is-active' : ''}`}
                aria-label={`Page ${p}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages || loading}
          className="admin-pagination-btn"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
