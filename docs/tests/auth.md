# Auth Test Cases

> Run these when: auth code changes, new auth features added, or on command "test auth"

## Register — Happy Path
- [ ] Register with valid display name (3+ chars), valid email, password (8+ chars, 1 digit, 1 uppercase), matching confirm, terms checked → account created, redirected to "Check your email" screen
- [ ] "Check your email" screen shows user's email address, resend button, spam folder hint

## Register — Client Validation
- [ ] Empty form submit → custom validation message (no browser native popups)
- [ ] Display name < 3 chars → "Display name must be at least 3 characters"
- [ ] Invalid email format → "Please enter a valid email address"
- [ ] Password < 8 chars → "Password must be at least 8 characters"
- [ ] Password no digit → "Password must contain at least one digit (0-9)"
- [ ] Password no uppercase → "Password must contain at least one uppercase letter (A-Z)"
- [ ] Passwords don't match → "Passwords do not match"
- [ ] Terms unchecked → "You must agree to the Terms of Service and Privacy Policy"
- [ ] All validation messages display in selected language (EN/LV)

## Register — Server Validation
- [ ] Duplicate email → "An account with this email already exists"
- [ ] Password missing digit (server-side) → "Password must contain at least one digit (0-9)"
- [ ] Password missing uppercase (server-side) → "Password must contain at least one uppercase letter (A-Z)"
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

## Email Confirmation
- [ ] After registration, confirmation email sent to user's inbox (via Resend)
- [ ] Email contains confirmation link pointing to /confirm-email?userId=...&token=...
- [ ] Clicking valid confirmation link → "Email confirmed!" success page
- [ ] Clicking expired/invalid link → "Confirmation failed" error page with "Go home" button
- [ ] "Resend confirmation email" button on check-email screen sends new email
- [ ] After confirming, login shows `emailConfirmed: true` in JWT
- [ ] Unconfirmed user can still login and browse (not blocked)
- [ ] `emailConfirmed` field available in auth context via `useAuth()`
