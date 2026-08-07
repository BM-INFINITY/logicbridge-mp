import React, { createContext, useContext, useState } from 'react';

const BuilderContext = createContext(null);

/**
 * Provider for transient Builder UI coordination
 */
export function BuilderProvider({ children }) {
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'pan' | 'connect'
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // null | 'ai' | 'templates' | 'sidebar'

  return (
    <BuilderContext.Provider
      value={{
        activeTool,
        setActiveTool,
        isDragging,
        setIsDragging,
        hoveredNodeId,
        setHoveredNodeId,
        activePanel,
        setActivePanel,
      }}
    >
      {children}
    </BuilderContext.Provider>
  );
}

/**
 * Hook to consume BuilderContext
 */
export function useBuilderContext() {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilderContext must be used within a BuilderProvider');
  }
  return context;
}

export default BuilderContext;
