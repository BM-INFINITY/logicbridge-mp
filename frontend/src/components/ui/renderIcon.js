import React from 'react';

/**
 * Safely renders an icon whether passed as a pre-instantiated React element,
 * a functional or class component, or a forwardRef component object ({ $$typeof, render }).
 *
 * Prevents runtime React errors: "Objects are not valid as a React child (found: object with keys {$$typeof, render})".
 *
 * @param {any} icon - React element, component function, forwardRef object, or primitive
 * @param {object} defaultProps - Optional props (e.g. { size: 16, className: '...' })
 * @returns {React.ReactNode}
 */
export function renderIcon(icon, defaultProps = {}) {
  if (icon == null || icon === false) return null;
  if (React.isValidElement(icon)) return icon;

  // React component functions (functional/class) or forwardRef / exotic component objects ({ $$typeof, render })
  if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && (icon.$$typeof || typeof icon.render === 'function'))
  ) {
    try {
      return React.createElement(icon, defaultProps);
    } catch {
      return null;
    }
  }

  // Primitive strings, numbers (e.g. text emojis like "⚡", "★", or character codes)
  if (typeof icon === 'string' || typeof icon === 'number') {
    return icon;
  }

  // Any other unsupported object or value that cannot be safely rendered as a React child
  return null;
}

export default renderIcon;

