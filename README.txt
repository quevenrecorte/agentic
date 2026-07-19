AGENTIC USAGE MONITOR v1.4

FIXES
- Login and dashboard views are now explicitly isolated using CSS classes.
- Only the login screen is shown while signed out.
- Only the dashboard is shown after Firebase confirms authentication.
- Firebase listeners are unsubscribed when authentication state changes.

NEW
- Added a free-text "Agentic / service name" field.
- You can enter any current or future service name, such as Codex, Antigravity, Replit, etc.
- Service name is stored with each account in Firebase and displayed as a compact tag.
- Existing v1.3 records remain compatible and display "Unspecified" until edited.

Firebase configuration and database structure remain compatible with v1.3.
