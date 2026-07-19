Gmail Reset Monitor v1.2

1. Firebase Console > Authentication > Sign-in method > enable Email/Password.
2. Firebase Console > Realtime Database > Rules > paste database.rules.json and Publish.
3. Upload index.html, style.css and app.js to your host.
4. If needed, add your GitHub Pages domain under Authentication > Settings > Authorized domains.

Data is stored under users/{Firebase Auth UID}/accounts and users/{Firebase Auth UID}/activity.
The included database rules prevent one authenticated user from reading another user's data.

Note: Firebase web configuration/API keys are normally included in frontend apps. Protect your data with Authentication and Security Rules; do not use open public database rules.
