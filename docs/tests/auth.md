# Auth Test Cases

> Run these when: auth code changes, new auth features added, or on command "test auth"

## Register — Happy Path
- [ ] Register with valid display name (3+ chars), valid email, password (8+ chars), matching confirm, terms checked → account created, auto-login, redirect to home, sidebar shows user name

## Register — Client Validation
- [ ] Empty form submit → browser "required" validation on first empty field
- [ ] Display name < 3 chars → "Display name must be at least 3 characters"
- [ ] Invalid email format → "Please enter a valid email address"
- [ ] Password < 8 chars → "Password must be at least 8 characters"
- [ ] Passwords don't match → "Passwords do not match"
- [ ] Terms unchecked → "You must agree to the Terms of Service and Privacy Policy"

## Register — Server Validation
- [ ] Duplicate email → "An account with this email already exists"
- [ ] Backend down → "Something went wrong. Please try again."

## Login — Happy Path
- [ ] Login with valid email + password → JWT saved, redirect to home, sidebar shows user name
- [ ] Page refresh after login → still logged in (JWT in localStorage)

## Login — Validation
- [ ] Wrong password → "Invalid email or password"
- [ ] Non-existent email → "Invalid email or password"
- [ ] Backend down → "Something went wrong. Please try again."

## Logout
- [ ] Click logout in sidebar → token cleared, sidebar shows "Login" button

## Navigation
- [ ] Login page "Register" link → goes to /register
- [ ] Register page "Log in" link → goes to /login
- [ ] Sidebar "Login" button → goes to /login

## i18n
- [ ] Switch to Latvian → all login/register text translates correctly
- [ ] Switch back to English → all text back to English

## Login Dialog (Modal)
- [ ] `useAuth().openLoginDialog()` opens login modal overlay
- [ ] Login via modal → modal closes, user state updates, no page navigation
- [ ] Close modal without logging in → returns to previous state
