import React from 'react';

/**
 * Standard SkeletonLoader component for loading placeholders.
 */
export default function SkeletonLoader({
  variant = 'text', // 'text' | 'title' | 'circle' | 'card' | 'rect'
  width,
  height,
  count = 1,
  className = '',
  style = {},
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'title':
        return {
          height: height || 22,
          width: width || '60%',
          borderRadius: 'var(--radius-xs, 4px)',
          marginBottom: 10,
        };
      case 'circle':
        return {
          width: width || 40,
          height: height || 40,
          borderRadius: '50%',
          flexShrink: 0,
        };
      case 'card':
        return {
          width: width || '100%',
          height: height || 140,
          borderRadius: 'var(--radius-lg, 16px)',
          marginBottom: 12,
        };
      case 'rect':
        return {
          width: width || '100%',
          height: height || 40,
          borderRadius: 'var(--radius-sm, 8px)',
        };
      case 'text':
      default:
        return {
          height: height || 14,
          width: width || '100%',
          borderRadius: 'var(--radius-xs, 4px)',
          marginBottom: 8,
        };
    }
  };

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          className={`skeleton ${className}`.trim()}
          style={{
            ...getVariantStyles(),
            ...style,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

