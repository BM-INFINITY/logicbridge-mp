/**
 * Icons.js — Central icon registry for LogicBridge.
 *
 * Maps node types and semantic keys to Lucide React components.
 * All node icon rendering should go through `getNodeIcon()` so
 * every surface (canvas, palette, sidebar header) stays in sync.
 */

import {
  Zap,
  Clock,
  Webhook,
  Globe,
  FileText,
  Timer,
  Shuffle,
  Mail,
  Table,
  GitBranch,
  Bot,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Play,
  Save,
  Rocket,
  LayoutDashboard,
  Activity,
  Link2,
  LogOut,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  LayoutTemplate,
  Sparkles,
  Download,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Shield,
  BarChart2,
  Brain,
  Braces,
  Type,
  Calculator,
  Calendar,
  Database,
} from 'lucide-react';

// ─── Node Type → Icon Component ──────────────────────────────────────────────

const NODE_ICONS = {
  'trigger-manual': Zap,
  'trigger-schedule': Clock,
  'trigger-webhook': Webhook,
  'action-http': Globe,
  'action-log': FileText,
  'action-delay': Timer,
  'action-transform': Shuffle,
  'action-email': Mail,
  'action-csv': Table,
  'action-json': Braces,
  'action-text': Type,
  'action-math': Calculator,
  'action-date': Calendar,
  'action-postgres': Database,
  'action-mongodb': Database,
  'logic-condition': GitBranch,
};

/**
 * Returns the Lucide icon component for a given node type.
 * Falls back to Settings for unknown types.
 *
 * @param {string} type - node type key (e.g. 'action-http')
 * @returns {React.ComponentType} Lucide icon component
 */
export function getNodeIcon(type) {
  return NODE_ICONS[type] || Settings;
}

// ─── Named semantic exports ───────────────────────────────────────────────────
// Import these wherever you need a consistent icon for a UI role.

export {
  // Node icons
  Zap,
  Clock,
  Webhook,
  Globe,
  FileText,
  Timer,
  Shuffle,
  Mail,
  Table,
  GitBranch,
  Bot,
  Settings,

  // Status icons
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,

  // Action icons
  Play,
  Save,
  Rocket,

  // Navigation icons
  LayoutDashboard,
  Activity,
  Link2,
  LogOut,

  // Common UI
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  LayoutTemplate,
  Sparkles,
  Download,
  Upload,

  // Auth icons
  Eye,
  EyeOff,
  Lock,

  // Feature icons
  Shield,
  BarChart2,
  Brain,
  Braces,
  Type,
  Calculator,
  Calendar,
};
