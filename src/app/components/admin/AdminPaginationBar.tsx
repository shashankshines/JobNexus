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

  const containerClasses = [
    'admin-pagination-bar',
    variant === 'integrated' ? 'is-integrated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="navigation" aria-label={`Pagination for ${itemName}`}>
      {/* Range Info & Page Size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        <div className="admin-pagination-info">
          Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> {itemName}
          {totalPages > 1 && (
            <span style={{ opacity: 0.7, marginLeft: '0.35rem' }}>
              (Page {safeCurrentPage} of {totalPages})
            </span>
          )}
        </div>

        {onPageSizeChange && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="admin-text-label" style={{ fontSize: '0.76rem' }}>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
              aria-label="Select items per page"
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '32px',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} per page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="admin-pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1 || loading}
          className="admin-pagination-btn"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

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

        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages || loading}
          className="admin-pagination-btn"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
