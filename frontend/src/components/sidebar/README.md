# Step Editor Sidebar Subcomponents

This directory contains configuration form subcomponents rendered inside `StepEditorSidebar.jsx`.

## Subcomponents
- **`SidebarHeader.jsx`**: Step title header, rename input, delete button, and close action.
- **`SidebarTabs.jsx`**: Tab navigation bar (Configuration, Testing, Documentation).
- **`SidebarFactory.jsx`**: Form factory selecting configuration components based on `node.type`.
- **`HttpConfig.jsx`**: HTTP Request URL, method, query parameters, headers, and body form.
- **`CsvConfig.jsx`**: CSV column header mapping, auto-detect, delimiter, and filename form.
- **`ConditionConfig.jsx`**: Left field, operator, and right value condition form.
- **`TransformConfig.jsx`**: JSON field mapping template form.
- **`GeneralConfig.jsx`**: Schedule cron expression and log message form.
- **`TestPanel.jsx`**: Step test runner and response preview inspector.
